import { appStore } from "../../../state/store.ts";
import { escapeHtml } from "../../../utils.ts";
import {
  buildMarkerSeedDraft,
  finalizeSpreadingCompletion,
  buildMarkerSpreadingViewModel,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  buildRollHandoverViewModel,
  buildOperatorHandledGarmentQtyFormula,
  buildOperatorHandledLayerFormula,
  buildOperatorHandledLengthFormula,
  buildRollActualCutGarmentQtyFormula,
  buildShortageQtyFormula,
  buildSpreadingImportedLengthFormula,
  buildTheoreticalCutGarmentQtyFormula,
  buildTheoreticalActualCutQtyFormula,
  computeOperatorCalculatedAmount,
  computeOperatorHandledGarmentQty,
  computeRemainingLength,
  computeOperatorHandledLengthByRoll,
  computeOperatorHandledLayerCount,
  computeRollActualCutGarmentQty,
  deriveSpreadingColorSummary,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  buildSpreadingSessionIdentityForMarkerBed,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deriveSpreadingStatus,
  deriveSpreadingCuttingStatus,
  deriveSpreadingListStatus,
  deriveSpreadingSessionGarmentQtyPerLayer,
  hasSpreadingActualExecution,
  resolveSpreadingOrderStatusFromSession,
  serializeMarkerSpreadingStorage,
  spreadingOrderStatusMeta,
  upsertMarkerRecord,
  upsertSpreadingSession,
  updateSessionStatus,
  validateSpreadingCompletion,
  summarizeSpreadingOperatorAmounts,
  findSpreadingPlanUnitById,
  validateMarkerForSpreadingImport
} from "./marker-spreading-model.ts";
import {
  buildMarkerDetailViewModel,
  buildMarkerNavigationPayload,
  buildMarkerSpreadingCountsByCutOrder,
  buildSpreadingDetailViewModel,
  buildSpreadingListViewModel,
  buildSpreadingReplenishmentWarning,
  buildMarkerWarningMessages,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeMarkerTotalPieces,
  computeSinglePieceUsage,
  computeNormalMarkerSpreadTotalLength,
  computeUsableLength,
  computeUsageSummary,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  deriveMarkerTemplateByMode,
  deriveMarkerModeMeta,
  deriveSpreadingModeMeta,
  getDefaultMarkerSpreadingContext,
  buildMarkerSpreadingPrototypeStore,
  MARKER_SIZE_KEYS,
  readMarkerSpreadingPrototypeData,
  summarizeSpreadingRolls
} from "./marker-spreading-utils.ts";
import { listSpreadingPieceOutputLines } from "../../../data/fcs/cutting/generated-fei-tickets.ts";
import {
  buildMarkerSpreadingProjection,
  buildSpreadingPlanUnitProjectionLabel
} from "./marker-spreading-projection.ts";
import {
  buildMarkerAllocationSourceRows,
  buildMarkerPieceExplosionViewModel
} from "./marker-piece-explosion.ts";
import { renderMaterialIdentityBlock } from "./material-identity.ts";
import {
  addHighLowCuttingRow,
  addHighLowPatternKey,
  addHighLowPatternRow,
  addMarkerAllocationLine,
  addMarkerLineItem,
  addMarkerSizeRow,
  addSpreadingOperator,
  addSpreadingOperatorForRoll,
  addSpreadingRoll,
  removeHighLowCuttingRow,
  removeHighLowPatternKey,
  removeHighLowPatternRow,
  removeMarkerAllocationLine,
  removeMarkerLineItem,
  removeMarkerSizeRow,
  removeSpreadingOperator,
  removeSpreadingRoll
} from "./marker-spreading-draft-actions.ts";
import { handleMarkerSpreadingSubmitAction } from "./marker-spreading-submit-actions.ts";
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar
} from "./layout.helpers.ts";
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from "./meta.ts";
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  serializeCuttingDrillContext
} from "./navigation-context.ts";
import {
  DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
  cuttingTableResources
} from "./cutting-table-resource.ts";
import { buildPdaCuttingMainlinePathForSession } from "../../../data/fcs/cutting/cutting-mainline.ts";
import { listSpreadingDifferencesBySpreadingOrder } from "../../../data/fcs/cutting/spreading-differences.ts";
void import("../../pda-cutting-execution-unit.ts");
void import("../../../router/routes-pda.ts");
const MOBILE_SOURCE_CHANNEL = "PDA";
const MOBILE_WRITEBACK_CHANNEL = "PDA_WRITEBACK";
const SPREADING_CREATE_OWNER_OPTIONS = [
  { value: "planner-chenjing", label: "\u8BA1\u5212\u5458-\u9648\u9759" },
  { value: "supervisor-liufang", label: "\u94FA\u5E03\u4E3B\u7BA1-\u5218\u82B3" },
  { value: "supervisor-zhouwei", label: "\u94FA\u5E03\u4E3B\u7BA1-\u5468\u4F1F" }
];
function getSpreadingDataSourceLabel(source) {
  if (source === "PC") return "\u7535\u8111\u5F55\u5165";
  if (source === MOBILE_SOURCE_CHANNEL) return "\u79FB\u52A8\u5F55\u5165";
  return "\u5168\u90E8";
}
function isMobileWritebackSource(sourceChannel, sourceWritebackId) {
  return sourceChannel === MOBILE_WRITEBACK_CHANNEL || Boolean(sourceWritebackId);
}
function getSourceChannelDisplayLabel(sourceChannel) {
  if (sourceChannel === MOBILE_WRITEBACK_CHANNEL) return "\u79FB\u52A8\u5F55\u5165";
  if (sourceChannel === "MIXED") return "\u6DF7\u5408\u5F55\u5165";
  return "\u7535\u8111\u5F55\u5165";
}
const state = {
  querySignature: "",
  prefilter: null,
  drillContext: null,
  activeTab: "ALL",
  keyword: "",
  contextNoFilter: "",
  sessionNoFilter: "",
  cutOrderFilter: "",
  markerPlanRefFilter: "",
  markerNoFilter: "",
  productionOrderFilter: "",
  styleSpuFilter: "",
  materialSkuFilter: "",
  colorFilter: "",
  markerModeFilter: "ALL",
  contextTypeFilter: "ALL",
  spreadingStageFilter: "ALL",
  sourceChannelFilter: "ALL",
  spreadingEditTab: "summary",
  adjustmentFilter: "ALL",
  imageFilter: "ALL",
  spreadingModeFilter: "ALL",
  spreadingCompletionSelection: [],
  createStep: "SELECT_MARKER",
  selectedCreateMarkerId: "",
  selectedCreateSourceSnapshot: null,
  createExceptionBackfill: false,
  createExceptionReason: "",
  createScheduleMode: "WHOLE_PLAN_ONE_TABLE",
  createOwnerAccountId: "",
  createCuttingTableId: "",
  createPlannedStartAt: "",
  createNote: "",
  createAssignments: {},
  markerDraft: null,
  spreadingDraft: null,
  feedback: null,
  importDecision: null
};
function getCurrentPathname() {
  return appStore.getState().pathname.split("?")[0] || getCanonicalCuttingPath("spreading-list");
}
function getSearchParams() {
  const pathname = appStore.getState().pathname;
  const [, query] = pathname.split("?");
  return new URLSearchParams(query || "");
}
function buildCanonicalSpreadingListPathFromCurrentLocation() {
  const query = getSearchParams().toString();
  const basePath = getCanonicalCuttingPath("spreading-list");
  return query ? `${basePath}?${query}` : basePath;
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
function buildMarkerRouteWithContext(pathname, payload) {
  return buildRouteWithQuery(pathname, {
    ...serializeCuttingDrillContext(state.drillContext),
    ...payload
  });
}
function buildCreateOwnerLabel(accountId) {
  return SPREADING_CREATE_OWNER_OPTIONS.find((option) => option.value === accountId)?.label || SPREADING_CREATE_OWNER_OPTIONS[0].label;
}
function matchesSpreadingCreateSource(source) {
  if (!matchesKeyword(state.keyword, [
    source.markerNo,
    source.sourceSchemeNo,
    source.sourceBedNo,
    ...source.cutOrderNos,
    source.markerPlanNo,
    ...source.productionOrderNos,
    source.styleCode,
    source.spuCode,
    source.materialSkuSummary
  ])) {
    return false;
  }
  if (!matchesIncludesFilter(state.cutOrderFilter, source.cutOrderNos)) return false;
  if (!matchesIncludesFilter(state.markerPlanRefFilter, [source.markerPlanNo])) return false;
  if (!matchesIncludesFilter(state.markerNoFilter, [source.markerNo, source.sourceSchemeNo, source.sourceBedNo])) return false;
  if (!matchesIncludesFilter(state.productionOrderFilter, source.productionOrderNos)) return false;
  if (!matchesIncludesFilter(state.styleSpuFilter, [source.styleCode, source.spuCode])) return false;
  if (!matchesIncludesFilter(state.materialSkuFilter, [source.materialSkuSummary])) return false;
  if (!matchesIncludesFilter(state.colorFilter, [source.colorSummary])) return false;
  if (state.spreadingModeFilter !== "ALL" && source.markerMode !== state.spreadingModeFilter) return false;
  return true;
}
function getSpreadingCreateSourceRows() {
  return buildMarkerSpreadingProjection({
    prefilter: state.prefilter
  }).createSources.filter(matchesSpreadingCreateSource);
}
function getSelectedCreateSource(rows = getSpreadingCreateSourceRows()) {
  if (!state.selectedCreateMarkerId) return null;
  const matched = rows.find((row) => row.markerId === state.selectedCreateMarkerId) || rows.find((row) => row.sourceBedId === state.selectedCreateMarkerId) || rows.find((row) => row.sourceSchemeId === state.selectedCreateMarkerId) || null;
  if (matched) return matched;
  const snapshot = state.selectedCreateSourceSnapshot;
  if (snapshot && (snapshot.markerId === state.selectedCreateMarkerId || snapshot.sourceBedId === state.selectedCreateMarkerId || snapshot.sourceSchemeId === state.selectedCreateMarkerId)) {
    return snapshot;
  }
  return null;
}
function getSelectedCreateSchemeSources(rows = getSpreadingCreateSourceRows()) {
  const selected = getSelectedCreateSource(rows);
  if (!selected?.sourceSchemeId) return selected ? [selected] : [];
  return rows.filter((row) => row.sourceSchemeId === selected.sourceSchemeId).sort((left, right) => left.sourceBedNo.localeCompare(right.sourceBedNo, "zh-CN", { numeric: true }));
}
function getCreateAssignmentKey(source) {
  return source.markerId || source.sourceBedId || source.sourceSchemeId;
}
function getDefaultCreateAssignment(source, index) {
  const startAt = state.createPlannedStartAt || formatDateTimeLocal();
  const plannedStartAt = state.createScheduleMode === "WHOLE_PLAN_ONE_TABLE" ? startAt : addMinutesToDateTimeLocal(startAt, index * DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES);
  return {
    cuttingTableId: state.createCuttingTableId || "",
    plannedStartAt,
    plannedEndAt: addMinutesToDateTimeLocal(plannedStartAt, DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES),
    ownerAccountId: state.createOwnerAccountId || ""
  };
}
function ensureCreateAssignments(rows) {
  const validKeys = new Set(rows.map(getCreateAssignmentKey));
  Object.keys(state.createAssignments).forEach((key) => {
    if (!validKeys.has(key)) delete state.createAssignments[key];
  });
  rows.forEach((row, index) => {
    const key = getCreateAssignmentKey(row);
    if (!state.createAssignments[key]) {
      state.createAssignments[key] = getDefaultCreateAssignment(row, index);
    }
  });
  return state.createAssignments;
}
function getCreateAssignment(source, index) {
  const key = getCreateAssignmentKey(source);
  if (!state.createAssignments[key]) {
    state.createAssignments[key] = getDefaultCreateAssignment(source, index);
  }
  return state.createAssignments[key];
}
function syncCreateAssignmentsByCuttingTable(cuttingTableId, patch) {
  if (!cuttingTableId) return;
  getSelectedCreateSchemeSources().forEach((row, index) => {
    const assignment = getCreateAssignment(row, index);
    if (assignment.cuttingTableId !== cuttingTableId) return;
    if (patch.plannedStartAt !== void 0) assignment.plannedStartAt = patch.plannedStartAt;
    if (patch.plannedEndAt !== void 0) assignment.plannedEndAt = patch.plannedEndAt;
    if (patch.ownerAccountId !== void 0) assignment.ownerAccountId = patch.ownerAccountId;
  });
}
function getLatestCreateAssignmentForCuttingTable(cuttingTableId, excludeKey) {
  if (!cuttingTableId) return null;
  const rows = getSelectedCreateSchemeSources();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const key = getCreateAssignmentKey(row);
    if (key === excludeKey) continue;
    const assignment = getCreateAssignment(row, index);
    if (assignment.cuttingTableId === cuttingTableId) return assignment;
  }
  return null;
}
function buildCreateAssignmentGroups(rows) {
  ensureCreateAssignments(rows);
  const groups = /* @__PURE__ */ new Map();
  rows.forEach((row, index) => {
    const assignment = getCreateAssignment(row, index);
    const groupKey = [
      assignment.cuttingTableId,
      assignment.plannedStartAt,
      assignment.plannedEndAt,
      assignment.ownerAccountId
    ].join("|");
    const existing = groups.get(groupKey);
    if (existing) {
      existing.rows.push(row);
      return;
    }
    groups.set(groupKey, {
      groupKey,
      rows: [row],
      cuttingTableId: assignment.cuttingTableId,
      plannedStartAt: assignment.plannedStartAt,
      plannedEndAt: assignment.plannedEndAt,
      ownerAccountId: assignment.ownerAccountId
    });
  });
  return Array.from(groups.values());
}
function getExceptionCreateContext() {
  const data = readMarkerSpreadingPrototypeData();
  return getDefaultMarkerSpreadingContext(data.rows, data.markerPlanRefs, state.prefilter);
}
function buildEmptyCreatePreview() {
  return {
    source: null,
    context: null,
    marker: null,
    plannedCutGarmentQty: 0,
    plannedCutGarmentQtyFormula: buildTheoreticalActualCutQtyFormula(0, 0, 0),
    plannedSpreadLengthM: 0,
    plannedSpreadLengthFormula: buildSpreadingImportedLengthFormula(0)
  };
}
function getSpreadingCreatePreview() {
  const source = getSelectedCreateSource();
  if (source) {
    return {
      source,
      context: source.spreadingContext,
      marker: source.markerRecord,
      plannedCutGarmentQty: source.plannedCutGarmentQty,
      plannedCutGarmentQtyFormula: source.plannedCutGarmentQtyFormula,
      plannedSpreadLengthM: source.plannedSpreadLengthM,
      plannedSpreadLengthFormula: source.plannedSpreadLengthFormula
    };
  }
  if (!state.createExceptionBackfill) {
    return buildEmptyCreatePreview();
  }
  const context = getExceptionCreateContext();
  const marker = buildMarkerSeedDraft(context, null);
  if (!context || !marker) {
    return buildEmptyCreatePreview();
  }
  const plannedCutGarmentQty = Math.max(Number(marker?.totalPieces || 0), 0);
  return {
    source: null,
    context,
    marker,
    plannedCutGarmentQty,
    plannedCutGarmentQtyFormula: buildTheoreticalActualCutQtyFormula(
      plannedCutGarmentQty,
      1,
      plannedCutGarmentQty
    ),
    plannedSpreadLengthM: Number(marker?.spreadTotalLength || 0),
    plannedSpreadLengthFormula: buildSpreadingImportedLengthFormula(Number(marker?.spreadTotalLength || 0))
  };
}
function renderReturnToSummaryButton() {
  if (!hasSummaryReturnContext(state.drillContext)) return "";
  return '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="return-summary">\u8FD4\u56DE\u88C1\u526A\u603B\u7ED3</button>';
}
function appendSummaryReturnAction(actions) {
  const returnAction = renderReturnToSummaryButton();
  return returnAction ? [...actions, returnAction] : actions;
}
function formatLength(value) {
  return `${Number(value || 0).toFixed(2)} \u7C73`;
}
function formatQty(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(value || 0, 0));
}
function computeSessionPlannedCutGarmentQty(session, garmentQtyPerLayer) {
  const planUnitTotal = (session.planUnits || []).reduce((sum, unit) => {
    const storedTotal = Math.max(Number(unit.plannedCutGarmentQty || 0), 0);
    const computedTotal = Math.max(Number(unit.plannedRepeatCount || 0), 0) * Math.max(Number(unit.garmentQtyPerUnit || 0), 0);
    return sum + (storedTotal || computedTotal);
  }, 0);
  if (planUnitTotal > 0) return Math.max(Math.round(planUnitTotal), 0);
  if (Number(session.theoreticalActualCutPieceQty || 0) > 0) return Math.max(Math.round(Number(session.theoreticalActualCutPieceQty || 0)), 0);
  return Math.max(Math.round(Number(session.plannedLayers || 0) * Math.max(garmentQtyPerLayer, 0)), 0);
}
function renderSpreadingOutputMatrix(sessionId) {
  const rows = listSpreadingPieceOutputLines().filter((item) => item.spreadingSessionId === sessionId);
  const matrixTable = `
    <table class="w-full min-w-[1180px] text-sm">
      <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
        <tr>
          <th class="px-3 py-3">\u9762\u6599\u5377\u53F7</th>
          <th class="px-3 py-3">\u5E03\u6599\u989C\u8272</th>
          <th class="px-3 py-3">\u5C3A\u7801</th>
          <th class="px-3 py-3">\u88C1\u7247\u90E8\u4F4D</th>
          <th class="px-3 py-3">\u6570\u91CF</th>
          <th class="px-3 py-3">\u88C1\u7247\u5355</th>
          <th class="px-3 py-3">\u751F\u4EA7\u5355</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.map(
    (row) => `
                    <tr class="border-b align-top">
                      <td class="px-3 py-3">${escapeHtml(row.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</td>
                      <td class="px-3 py-3">${escapeHtml(row.fabricColor || "\u6682\u65E0\u6570\u636E")}</td>
                      <td class="px-3 py-3">${escapeHtml(row.sizeCode || "\u6682\u65E0\u6570\u636E")}</td>
                      <td class="px-3 py-3">${escapeHtml(row.partName || "\u6682\u65E0\u6570\u636E")}</td>
                      <td class="px-3 py-3">${escapeHtml(`${formatQty(row.bundleQty || 0)} \u4EF6`)}</td>
                      <td class="px-3 py-3">${escapeHtml(row.cutOrderNo || "\u6682\u65E0\u6570\u636E")}</td>
                      <td class="px-3 py-3">${escapeHtml(row.productionOrderNo || "\u6682\u65E0\u6570\u636E")}</td>
                    </tr>
                  `
  ).join("") : '<tr><td colspan="7" class="px-3 py-6 text-center text-xs text-muted-foreground">\u6682\u65E0\u6570\u636E</td></tr>'}
      </tbody>
    </table>
  `;
  return `
    <div class="mt-3 space-y-2 rounded-lg border border-dashed bg-background/60 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-medium text-foreground">\u94FA\u5E03\u4EA7\u51FA</div>
        <div class="text-xs text-muted-foreground">${escapeHtml(`\u5171 ${formatQty(rows.length)} \u884C`)}</div>
      </div>
      ${renderStickyTableScroller(matrixTable, "max-h-[28vh]")}
    </div>
  `;
}
function formatCurrency(value) {
  if (value === null || value === void 0 || Number.isNaN(Number(value))) return "\u5F85\u8865\u5F55";
  return `${Number(value).toFixed(2)} \u5143`;
}
function formatDateText(value) {
  return value || "\u5F85\u8865";
}
function formatScheduleDateTime(value) {
  if (!value) return "\u2014";
  return value.replace("T", " ").slice(0, 16);
}
function renderSchedulePlanActualCell(plannedAt, actualAt) {
  return `
    <div class="space-y-1 text-xs leading-5">
      <div><span class="text-muted-foreground">\u8BA1\u5212\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(plannedAt))}</span></div>
      <div><span class="text-muted-foreground">\u5B9E\u9645\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(actualAt))}</span></div>
    </div>
  `;
}
function renderCuttingTimeCell(startedAt, finishedAt) {
  return `
    <div class="space-y-1 text-xs leading-5">
      <div><span class="text-muted-foreground">\u5F00\u59CB\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(startedAt))}</span></div>
      <div><span class="text-muted-foreground">\u7ED3\u675F\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(finishedAt))}</span></div>
    </div>
  `;
}
function findSpreadingOrderForRow(row, projection = buildMarkerSpreadingProjection()) {
  return projection.spreadingOrders.find(
    (order) => order.spreadingOrderId === row.spreadingSessionId || order.spreadingOrderNo === row.sessionNo || order.spreadingOrderId === row.session.spreadingSessionId
  ) || null;
}
function resolvePdaWritebackSummary(session) {
  const writebackIds = [
    session.sourceWritebackId,
    ...session.rolls.map((roll) => roll.sourceWritebackId),
    ...session.operators.map((operator) => operator.sourceWritebackId)
  ].filter(Boolean);
  const pdaTimes = [
    session.updatedFromPdaAt,
    ...session.rolls.map((roll) => roll.updatedFromPdaAt),
    ...session.operators.map((operator) => operator.updatedFromPdaAt)
  ].filter(Boolean).sort((left, right) => right.localeCompare(left, "zh-CN"));
  const operatorName = session.operators.find((operator) => operator.operatorName)?.operatorName || session.rolls.find((roll) => roll.operatorNames?.length)?.operatorNames?.join(" / ") || session.ownerName || "\u5F85\u8865";
  const hasPdaSource = session.sourceChannel === MOBILE_WRITEBACK_CHANNEL || session.sourceChannel === "MIXED" || session.rolls.some((roll) => roll.sourceChannel === MOBILE_WRITEBACK_CHANNEL) || session.operators.some((operator) => operator.sourceChannel === MOBILE_WRITEBACK_CHANNEL);
  const hasFailedWriteback = writebackIds.some((id) => /fail|failed|conflict|error/i.test(id));
  if (hasFailedWriteback) {
    return {
      statusLabel: "\u540C\u6B65\u5931\u8D25",
      statusClassName: "border-rose-200 bg-rose-50 text-rose-700",
      latestAt: pdaTimes[0] || session.updatedAt || "\u5F85\u8865",
      operatorName,
      sourceLabel: "PDA \u5199\u56DE"
    };
  }
  if (hasPdaSource || writebackIds.length) {
    return {
      statusLabel: pdaTimes.length ? "\u5DF2\u540C\u6B65" : "\u5F85\u540C\u6B65",
      statusClassName: pdaTimes.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
      latestAt: pdaTimes[0] || "\u5F85\u540C\u6B65",
      operatorName,
      sourceLabel: "PDA \u5199\u56DE"
    };
  }
  return {
    statusLabel: session.status === "DRAFT" ? "\u65E0\u5199\u56DE" : "\u7535\u8111\u5F55\u5165",
    statusClassName: "border-slate-200 bg-slate-50 text-slate-600",
    latestAt: session.updatedAt || "\u5F85\u8865",
    operatorName,
    sourceLabel: getSourceChannelDisplayLabel(session.sourceChannel)
  };
}
function resolveWebSpreadingSummary(row, projection = buildMarkerSpreadingProjection()) {
  const session = row.session;
  const order = findSpreadingOrderForRow(row, projection);
  const derived = resolveSpreadingDerivedState(session);
  const rollSummary = derived.rollSummary;
  const varianceSummary = derived.varianceSummary;
  const plannedLayerCount = Math.max(Number(order?.plannedLayerCount || session.plannedLayers || derived.markerRecord?.plannedLayerCount || 0), 0);
  const actualLayerCount = Math.max(Number(rollSummary.totalLayers || session.actualLayers || 0), 0);
  const plannedUsage = Math.max(Number(order?.plannedMaterialUsage || 0), 0) || Math.max(Number(derived.markerRecord?.spreadTotalLength || session.theoreticalSpreadTotalLength || 0), 0) || (session.planUnits || []).reduce((sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0), 0);
  const actualUsage = Math.max(Number(rollSummary.totalActualLength || session.totalActualLength || row.spreadActualLengthM || 0), 0);
  const plannedQty = Math.max(Number(order?.plannedGarmentQty || varianceSummary?.plannedCutGarmentQty || row.plannedCutGarmentQty || 0), 0);
  const actualCutQty = Math.max(Number(varianceSummary?.actualCutGarmentQty || row.actualCutGarmentQty || session.actualCutGarmentQty || 0), 0);
  const layerDiff = actualLayerCount - plannedLayerCount;
  const usageDiff = Number((actualUsage - plannedUsage).toFixed(2));
  const qtyDiff = actualCutQty - plannedQty;
  const pda = resolvePdaWritebackSummary(session);
  const statusKey = resolveSpreadingOrderStatusFromSession(session);
  const status = spreadingOrderStatusMeta[statusKey];
  const needsReview = pda.statusLabel === "\u540C\u6B65\u5931\u8D25" || row.hasVariance || Math.abs(layerDiff) > 0 || Math.abs(usageDiff) > 0.01 || Math.abs(qtyDiff) > 0;
  return {
    order,
    statusKey,
    status,
    plannedLayerCount,
    actualLayerCount,
    plannedUsage,
    actualUsage,
    plannedQty,
    actualCutQty,
    layerDiff,
    usageDiff,
    qtyDiff,
    pda,
    needsReview
  };
}
function formatSignedNumber(value, unit = "") {
  if (!value) return `0${unit ? ` ${unit}` : ""}`;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("zh-CN").format(value)}${unit ? ` ${unit}` : ""}`;
}
function formatSignedLength(value) {
  if (!value) return "0.00 \u7C73";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Number(value).toFixed(2)} \u7C73`;
}
function renderCompactMetricLines(lines) {
  return `
    <div class="space-y-1 text-xs leading-5">
      ${lines.map(([label, value]) => `
        <div class="flex items-start justify-between gap-2">
          <span class="shrink-0 text-muted-foreground">${escapeHtml(label)}</span>
          <span class="text-right font-medium text-foreground">${escapeHtml(value)}</span>
        </div>
      `).join("")}
    </div>
  `;
}
function formatDateTimeLocal(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
function addMinutesToDateTimeLocal(value, minutes) {
  const date = value ? new Date(value) : /* @__PURE__ */ new Date();
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() + minutes);
  return formatDateTimeLocal(date);
}
function getDateTimeDurationMinutes(startAt, endAt) {
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) return DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES;
  return Math.round((endTime - startTime) / 6e4);
}
function resolveCuttingTable(cuttingTableId) {
  return cuttingTableResources.find((table) => table.cuttingTableId === cuttingTableId) || cuttingTableResources[0];
}
function hasCuttingTableScheduleConflict(draft2, sessions) {
  if (!draft2.cuttingTableId || !draft2.plannedStartAt || !draft2.plannedEndAt) return false;
  const draftStart = new Date(draft2.plannedStartAt).getTime();
  const draftEnd = new Date(draft2.plannedEndAt).getTime();
  if (!Number.isFinite(draftStart) || !Number.isFinite(draftEnd) || draftEnd <= draftStart) return false;
  return sessions.some((session) => {
    if (session.spreadingSessionId === draft2.spreadingSessionId) return false;
    if (session.cuttingTableId !== draft2.cuttingTableId) return false;
    if (!session.plannedStartAt || !session.plannedEndAt) return false;
    const sessionStart = new Date(session.plannedStartAt).getTime();
    const sessionEnd = new Date(session.plannedEndAt).getTime();
    if (!Number.isFinite(sessionStart) || !Number.isFinite(sessionEnd)) return false;
    return draftStart < sessionEnd && draftEnd > sessionStart;
  });
}
function hasCuttingTableScheduleConflictInDrafts(draft2, drafts) {
  if (!draft2.cuttingTableId || !draft2.plannedStartAt || !draft2.plannedEndAt) return false;
  const draftStart = new Date(draft2.plannedStartAt).getTime();
  const draftEnd = new Date(draft2.plannedEndAt).getTime();
  if (!Number.isFinite(draftStart) || !Number.isFinite(draftEnd) || draftEnd <= draftStart) return false;
  return drafts.some((item) => {
    if (item.spreadingSessionId === draft2.spreadingSessionId) return false;
    if (item.cuttingTableId !== draft2.cuttingTableId) return false;
    if (!item.plannedStartAt || !item.plannedEndAt) return false;
    const itemStart = new Date(item.plannedStartAt).getTime();
    const itemEnd = new Date(item.plannedEndAt).getTime();
    if (!Number.isFinite(itemStart) || !Number.isFinite(itemEnd)) return false;
    return draftStart < itemEnd && draftEnd > itemStart;
  });
}
function renderTag(label, className) {
  return `<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-4 ${className}">${escapeHtml(label)}</span>`;
}
function renderSection(title, body) {
  return `
    <section class="rounded-xl border bg-card shadow-sm">
      <div class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </div>
      <div class="p-4">
        ${body}
      </div>
    </section>
  `;
}
function renderFormulaLine(formula) {
  return formula ? `<p class="mt-px font-mono text-[8px] leading-2.5 text-muted-foreground">${escapeHtml(formula)}</p>` : "";
}
function renderValueWithFormula(value, formula, extraClass = "") {
  return `
    <div class="space-y-px">
      <p class="${extraClass || "text-sm font-medium leading-4 text-foreground"}">${escapeHtml(value || "\u5F85\u8865")}</p>
      ${renderFormulaLine(formula)}
    </div>
  `;
}
function renderCompactListValueWithFormula(value, formula) {
  return `
    <div class="space-y-0.5">
      <p class="text-[11px] font-medium leading-3 text-foreground">${escapeHtml(value || "\u5F85\u8865")}</p>
      ${formula ? `<p class="font-mono text-[8px] leading-2.5 text-muted-foreground">${escapeHtml(formula)}</p>` : ""}
    </div>
  `;
}
function downloadCsvFile(filename, rows) {
  const csv = rows.map(
    (row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
  ).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function buildSumFormula(result, values, digits = 2) {
  const normalized = values.map((value) => Number(value || 0));
  const left = Number(result || 0).toFixed(digits);
  const right = normalized.length ? normalized.map((value) => value.toFixed(digits)).join(" + ") : "0";
  return `${left} \u7C73 = ${right} \u7C73`;
}
function buildLayerSumFormula(result, values) {
  const normalized = values.map((value) => Math.max(Math.round(Number(value || 0)), 0));
  const right = normalized.length ? normalized.map((value) => `${formatQty(value)} \u5C42`).join(" + ") : "0 \u5C42";
  return `${formatQty(result)} \u5C42 = ${right}`;
}
function buildDifferenceFormula(result, minuend, subtrahend, digits = 2) {
  return `${Number(result || 0).toFixed(digits)} \u7C73 = ${Number(minuend || 0).toFixed(digits)} \u7C73 - ${Number(subtrahend || 0).toFixed(digits)} \u7C73`;
}
function buildRollUsableLengthFormula(actualLength, headLength, tailLength, usableLength) {
  return `${Number(usableLength || 0).toFixed(2)} \u7C73 = ${Number(actualLength || 0).toFixed(2)} \u7C73 - ${Number(headLength || 0).toFixed(2)} \u7C73 - ${Number(tailLength || 0).toFixed(2)} \u7C73`;
}
function buildRemainingLengthFormula(labeledLength, actualLength, remainingLength) {
  return `${Number(remainingLength || 0).toFixed(2)} \u7C73 = ${Number(labeledLength || 0).toFixed(2)} \u7C73 - ${Number(actualLength || 0).toFixed(2)} \u7C73`;
}
function buildQtySumFormula(result, values) {
  const left = formatQty(result || 0);
  const right = values.length ? values.map((value) => formatQty(value || 0)).join(" + ") : "0";
  return `${left} \u4EF6 = ${right} \u4EF6`;
}
function renderInfoGrid(items) {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${items.map(
    (item) => `
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <p class="mt-1 text-sm font-medium text-foreground">${escapeHtml(item.value || "\u5F85\u8865")}</p>
              ${renderFormulaLine(item.formula)}
              ${item.hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</p>` : ""}
            </article>
          `
  ).join("")}
    </div>
  `;
}
function renderStatusBadge(label, className) {
  return `<span class="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${className}">${escapeHtml(label)}</span>`;
}
function renderSpreadingEditTabNav(activeTab) {
  const tabs = [
    { key: "summary", label: "\u6267\u884C\u6458\u8981" },
    { key: "rolls", label: "\u5377\u8BB0\u5F55" },
    { key: "operators", label: "\u6362\u73ED\u4E0E\u4EBA\u5458" },
    { key: "variance", label: "\u5DEE\u5F02\u4E0E\u8865\u6599" }
  ];
  return `
    <section class="rounded-lg border bg-card p-2 shadow-sm" data-cutting-spreading-edit-tab-shell>
      <div class="flex flex-wrap gap-2">
        ${tabs.map(
    (tab) => `
              <button
                type="button"
                class="inline-flex items-center rounded-md px-3 py-3 text-sm font-medium ${activeTab === tab.key ? "bg-blue-600 text-white hover:bg-blue-700" : "border hover:bg-muted"}"
                data-cutting-marker-action="switch-spreading-edit-tab"
                data-edit-tab="${tab.key}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function buildSpreadingPlanUnitLabel(planUnit) {
  return buildSpreadingPlanUnitProjectionLabel(planUnit);
}
function renderTextInput(label, value, attrs, placeholder = "\u8BF7\u8F93\u5165") {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="text"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      />
    </label>
  `;
}
function renderReadonlyField(label, value, options) {
  return `
    <div class="space-y-2" ${options?.attrs || ""}>
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <div class="min-h-10 rounded-md border bg-muted/10 px-3 py-3">
        ${renderValueWithFormula(value, options?.formula)}
      </div>
    </div>
  `;
}
function renderNumberInput(label, value, attrs, step = "0.01") {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="number"
        value="${escapeHtml(String(value ?? ""))}"
        step="${escapeHtml(step)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      />
    </label>
  `;
}
function renderTextarea(label, value, attrs, rows = 3) {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <textarea
        rows="${rows}"
        class="w-full rounded-md border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      >${escapeHtml(value)}</textarea>
    </label>
  `;
}
function renderSelect(label, value, attrs, options) {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" ${attrs}>
        ${options.map(
    (option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
  ).join("")}
      </select>
    </label>
  `;
}
function renderListTextInput(label, value, attrs, placeholder = "\u8BF7\u8F93\u5165") {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="text"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      />
    </label>
  `;
}
function renderListSelect(label, value, attrs, options) {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" ${attrs}>
        ${options.map(
    (option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
  ).join("")}
      </select>
    </label>
  `;
}
function cloneMarkerRecord(record) {
  return JSON.parse(JSON["stringify"](record));
}
function cloneSpreadingSession(session) {
  return JSON.parse(JSON["stringify"](session));
}
function createEmptyMarkerSizeValueMap() {
  return Object.fromEntries(MARKER_SIZE_KEYS.map((sizeKey) => [sizeKey, 0]));
}
function createEmptyPatternValues(patternKeys) {
  return Object.fromEntries(patternKeys.map((patternKey) => [patternKey, 0]));
}
function createEmptyHighLowCuttingRow(markerId, index) {
  return {
    rowId: `high-low-cutting-${Date.now()}-${index}`,
    markerId,
    color: "",
    sizeValues: createEmptyMarkerSizeValueMap(),
    total: 0
  };
}
function createEmptyHighLowPatternRow(markerId, index, patternKeys) {
  return {
    rowId: `high-low-pattern-${Date.now()}-${index}`,
    markerId,
    color: "",
    patternValues: createEmptyPatternValues(patternKeys),
    total: 0
  };
}
function formatSizeBalance(requiredQty, allocatedQty) {
  const difference = allocatedQty - requiredQty;
  if (difference === 0) return "\u5DF2\u914D\u5E73";
  return difference > 0 ? `\u591A\u5206\u914D ${formatQty(difference)}` : `\u5C11\u5206\u914D ${formatQty(Math.abs(difference))}`;
}
function getMarkerMappingStatusTag(status) {
  if (status === "MATCHED") return renderTag("\u5DF2\u5339\u914D", "bg-emerald-100 text-emerald-700");
  if (status === "MATERIAL_PENDING_CONFIRM") return renderTag("\u9762\u6599\u5F85\u786E\u8BA4", "bg-amber-100 text-amber-700");
  if (status === "MISSING_TECH_PACK") return renderTag("\u672A\u5173\u8054\u6280\u672F\u5305", "bg-rose-100 text-rose-700");
  if (status === "MISSING_SKU") return renderTag("\u672A\u5339\u914D SKU", "bg-rose-100 text-rose-700");
  if (status === "MISSING_COLOR_MAPPING") return renderTag("\u672A\u5339\u914D\u989C\u8272\u6620\u5C04", "bg-rose-100 text-rose-700");
  if (status === "MISSING_PIECE_MAPPING") return renderTag("\u672A\u5339\u914D\u88C1\u7247\u6620\u5C04", "bg-rose-100 text-rose-700");
  return renderTag("\u5F85\u786E\u8BA4", "bg-slate-100 text-slate-700");
}
function createMarkerAllocationLineFromSource(marker, sourceRow, index) {
  return {
    allocationId: `marker-allocation-${Date.now()}-${index}`,
    markerId: marker.markerId,
    sourceCutOrderId: sourceRow?.sourceCutOrderId || "",
    sourceCutOrderNo: sourceRow?.sourceCutOrderNo || "",
    sourceProductionOrderId: sourceRow?.sourceProductionOrderId || "",
    sourceProductionOrderNo: sourceRow?.sourceProductionOrderNo || "",
    styleCode: sourceRow?.styleCode || marker.styleCode || "",
    spuCode: sourceRow?.spuCode || marker.spuCode || "",
    techPackSpuCode: sourceRow?.techPackSpuCode || marker.techPackSpuCode || "",
    color: sourceRow?.color || "",
    materialSku: sourceRow?.materialSku || "",
    sizeLabel: "",
    plannedGarmentQty: 0,
    note: ""
  };
}
function getMarkerDraftSourceRows(draft2) {
  const data = readMarkerSpreadingPrototypeData();
  return buildMarkerAllocationSourceRows(draft2, data.rowsById).map((row) => ({
    sourceCutOrderId: row.cutOrderId,
    sourceCutOrderNo: row.cutOrderNo,
    sourceProductionOrderId: row.productionOrderId,
    sourceProductionOrderNo: row.productionOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    techPackSpuCode: row.techPackSpuCode || "",
    color: row.color,
    materialSku: row.materialSkuSummary,
    allocationSummaryText: "",
    allocationTotalQty: 0
  }));
}
function applyAllocationSourceRowToLine(allocationLine, sourceRow, draft2) {
  return {
    ...allocationLine,
    markerId: draft2.markerId,
    sourceCutOrderId: sourceRow?.sourceCutOrderId || "",
    sourceCutOrderNo: sourceRow?.sourceCutOrderNo || "",
    sourceProductionOrderId: sourceRow?.sourceProductionOrderId || "",
    sourceProductionOrderNo: sourceRow?.sourceProductionOrderNo || "",
    styleCode: sourceRow?.styleCode || draft2.styleCode || "",
    spuCode: sourceRow?.spuCode || draft2.spuCode || "",
    techPackSpuCode: sourceRow?.techPackSpuCode || draft2.techPackSpuCode || "",
    color: sourceRow?.color || "",
    materialSku: sourceRow?.materialSku || ""
  };
}
function buildMarkerDraftPieceExplosion(draft2) {
  const data = readMarkerSpreadingPrototypeData();
  const sourceRows = buildMarkerAllocationSourceRows(draft2, data.rowsById);
  return buildMarkerPieceExplosionViewModel({
    marker: draft2,
    sourceRows
  });
}
function renderMarkerSourceRowsTable(rows) {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">\u5F53\u524D\u4E0A\u4E0B\u6587\u672A\u8BC6\u522B\u5230\u5173\u8054\u88C1\u7247\u5355\u3002</div>';
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u6765\u6E90\u88C1\u7247\u5355\u53F7</th>
            <th class="px-3 py-3">\u6765\u6E90\u751F\u4EA7\u5355\u53F7</th>
            <th class="px-3 py-3">\u6B3E\u53F7 / SPU</th>
            <th class="px-3 py-3">\u6280\u672F\u5305 SPU</th>
            <th class="px-3 py-3">\u989C\u8272</th>
            <th class="px-3 py-3">\u9762\u6599</th>
            <th class="px-3 py-3">\u5F53\u524D\u5206\u914D\u6458\u8981</th>
            <th class="px-3 py-3">\u5206\u914D\u5408\u8BA1\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(
    (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sourceProductionOrderNo || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(`${row.styleCode || "\u5F85\u8865"} / ${row.spuCode || "\u5F85\u8865"}`)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.techPackSpuCode || "\u672A\u5173\u8054")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${renderMaterialIdentityBlock({
      materialSku: row.materialSku || "\u5F85\u8865",
      materialLabel: row.materialSku || "\u5F85\u8865",
      materialAlias: row.materialAlias,
      materialImageUrl: row.materialImageUrl
    }, { compact: true })}</td>
                  <td class="px-3 py-3">${escapeHtml(row.allocationSummaryText || "\u5F85\u8865\u5206\u914D")}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.allocationTotalQty))}</td>
                </tr>
              `
  ).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function renderMarkerAllocationTable(rows) {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u551B\u67B6\u5206\u914D\u660E\u7EC6\u3002</div>';
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u6765\u6E90\u88C1\u7247\u5355\u53F7</th>
            <th class="px-3 py-3">\u989C\u8272</th>
            <th class="px-3 py-3">\u5C3A\u7801</th>
            <th class="px-3 py-3">\u9762\u6599</th>
            <th class="px-3 py-3">plannedGarmentQty</th>
            <th class="px-3 py-3">\u6280\u672F\u5305</th>
            <th class="px-3 py-3">SKU</th>
            <th class="px-3 py-3">\u6620\u5C04\u72B6\u6001</th>
            <th class="px-3 py-3">\u5F02\u5E38</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(
    (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeLabel || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${renderMaterialIdentityBlock({
      materialSku: row.materialSku || "\u5F85\u8865",
      materialLabel: row.materialSku || "\u5F85\u8865",
      materialAlias: row.materialAlias,
      materialImageUrl: row.materialImageUrl
    }, { compact: true })}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-3">${escapeHtml(row.techPackSpuCode || "\u672A\u5173\u8054")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.skuCode || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.exceptionText || "\u2014")}</td>
                </tr>
              `
  ).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function renderMarkerSkuSummaryTable(rows) {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684 SKU \u62C6\u89E3\u7ED3\u679C\u3002</div>';
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u6765\u6E90\u88C1\u7247\u5355\u53F7</th>
            <th class="px-3 py-3">\u989C\u8272</th>
            <th class="px-3 py-3">\u5C3A\u7801</th>
            <th class="px-3 py-3">SKU</th>
            <th class="px-3 py-3">\u8BA1\u5212\u6210\u8863\u6570</th>
            <th class="px-3 py-3">\u62C6\u89E3\u603B\u88C1\u7247\u6570</th>
            <th class="px-3 py-3">\u6D89\u53CA\u90E8\u4F4D\u6570</th>
            <th class="px-3 py-3">\u6620\u5C04\u72B6\u6001</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(
    (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeLabel || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.skuCode || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.explodedPieceTotal))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.involvedPartCount))}</td>
                  <td class="px-3 py-3">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
                </tr>
              `
  ).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function renderMarkerPieceDetailTable(rows) {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u90E8\u4F4D\u88C1\u7247\u62C6\u89E3\u660E\u7EC6\u3002</div>';
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u6765\u6E90\u88C1\u7247\u5355\u53F7</th>
            <th class="px-3 py-3">\u989C\u8272</th>
            <th class="px-3 py-3">\u5C3A\u7801</th>
            <th class="px-3 py-3">SKU</th>
            <th class="px-3 py-3">\u9762\u6599</th>
            <th class="px-3 py-3">\u7EB8\u6837</th>
            <th class="px-3 py-3">\u90E8\u4F4D</th>
            <th class="px-3 py-3">\u5355\u4EF6\u7247\u6570</th>
            <th class="px-3 py-3">\u8BA1\u5212\u6210\u8863\u6570</th>
            <th class="px-3 py-3">\u62C6\u89E3\u88C1\u7247\u6570</th>
            <th class="px-3 py-3">\u6620\u5C04\u72B6\u6001</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(
    (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeLabel || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.skuCode || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${renderMaterialIdentityBlock({
      materialSku: row.materialSku || "\u5F85\u8865",
      materialLabel: row.materialSku || "\u5F85\u8865",
      materialAlias: row.materialAlias,
      materialImageUrl: row.materialImageUrl
    }, { compact: true })}</td>
                  <td class="px-3 py-3">${escapeHtml(row.patternName || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(row.pieceName || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.pieceCountPerUnit))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.explodedPieceQty))}</td>
                  <td class="px-3 py-3">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
                </tr>
              `
  ).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function ensureMarkerDraftShape(draft2) {
  draft2.cutOrderNos = draft2.cutOrderNos || [];
  draft2.techPackSpuCode = draft2.techPackSpuCode || "";
  draft2.allocationLines = draft2.allocationLines || [];
  const templateType = deriveMarkerTemplateByMode(draft2.markerMode);
  if (templateType === "row-template") {
    if (!(draft2.lineItems || []).length) {
      draft2.lineItems = [createEmptyMarkerLineItem(0)];
    }
    return draft2;
  }
  draft2.highLowPatternKeys = draft2.highLowPatternKeys?.length ? draft2.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS];
  if (!(draft2.highLowCuttingRows || []).length) {
    draft2.highLowCuttingRows = [createEmptyHighLowCuttingRow(draft2.markerId, 0)];
  }
  if (!(draft2.highLowPatternRows || []).length) {
    draft2.highLowPatternRows = [createEmptyHighLowPatternRow(draft2.markerId, 0, draft2.highLowPatternKeys)];
  }
  return draft2;
}
function createEmptyMarkerLineItem(index) {
  return {
    lineItemId: `marker-line-${Date.now()}-${index}`,
    markerId: "",
    lineNo: index + 1,
    layoutCode: `A-${index + 1}`,
    layoutDetailText: "",
    color: "",
    ratioLabel: "",
    spreadRepeatCount: 1,
    markerLength: 0,
    markerPieceCount: 0,
    pieceCount: 0,
    singlePieceUsage: 0,
    spreadTotalLength: 0,
    spreadingTotalLength: 0,
    widthHint: "",
    note: ""
  };
}
function createFallbackMarkerDraft() {
  return ensureMarkerDraftShape({
    markerId: `marker-${Date.now()}`,
    markerNo: `MKP-${String(Date.now()).slice(-6)}`,
    contextType: "cut-order",
    cutOrderIds: [],
    markerPlanId: "",
    markerPlanNo: "",
    styleCode: "",
    spuCode: "",
    techPackSpuCode: "",
    materialSkuSummary: "",
    colorSummary: "",
    markerMode: "normal",
    sizeDistribution: [
      { sizeLabel: "S", quantity: 0 },
      { sizeLabel: "M", quantity: 0 },
      { sizeLabel: "L", quantity: 0 },
      { sizeLabel: "XL", quantity: 0 },
      { sizeLabel: "2XL", quantity: 0 },
      { sizeLabel: "3XL", quantity: 0 },
      { sizeLabel: "4XL", quantity: 0 },
      { sizeLabel: "onesize", quantity: 0 },
      { sizeLabel: "plusonesize", quantity: 0 }
    ],
    totalPieces: 0,
    netLength: 0,
    singlePieceUsage: 0,
    spreadTotalLength: 0,
    materialCategory: "",
    materialAttr: "",
    sizeRatioPlanText: "",
    plannedLayerCount: 0,
    plannedMarkerCount: 0,
    markerLength: 0,
    procurementUnitUsage: 0,
    actualUnitUsage: 0,
    fabricSku: "",
    plannedMaterialMeter: 0,
    actualMaterialMeter: 0,
    actualCutQty: 0,
    allocationLines: [],
    lineItems: [createEmptyMarkerLineItem(0)],
    highLowPatternKeys: [...DEFAULT_HIGH_LOW_PATTERN_KEYS],
    highLowCuttingRows: [],
    highLowPatternRows: [],
    warningMessages: [],
    markerImageUrl: "",
    markerImageName: "",
    adjustmentRequired: false,
    adjustmentNote: "",
    replacementDraftFlag: false,
    note: "",
    updatedAt: ""
  });
}
function buildNewMarkerDraft() {
  const data = readMarkerSpreadingPrototypeData();
  const context = getDefaultMarkerSpreadingContext(data.rows, data.markerPlanRefs, state.prefilter);
  const seeded = context ? buildMarkerSeedDraft(context, null) : null;
  const draft2 = seeded ? cloneMarkerRecord(seeded) : createFallbackMarkerDraft();
  draft2.markerId = `marker-${Date.now()}`;
  draft2.markerNo = draft2.markerNo || `MKP-${String(data.store.markers.length + 1).padStart(4, "0")}`;
  draft2.updatedAt = "";
  draft2.markerImageUrl = "";
  draft2.adjustmentRequired = Boolean(draft2.adjustmentRequired);
  draft2.adjustmentNote = draft2.adjustmentNote || "";
  draft2.replacementDraftFlag = Boolean(draft2.replacementDraftFlag);
  return ensureMarkerDraftShape(draft2);
}
function buildContextPayloadFromMarker(record) {
  const row = getMarkerRow(record.markerId);
  return row ? buildMarkerNavigationPayload(row) : { markerId: record.markerId };
}
function buildImportContextFromMarker(record) {
  const data = readMarkerSpreadingPrototypeData();
  const cutOrderRows = record.cutOrderIds.map((id) => data.rowsById[id]).filter((row) => Boolean(row));
  if (!cutOrderRows.length && !record.markerPlanId && !record.markerPlanNo) return null;
  return {
    contextType: record.contextType,
    cutOrderIds: [...record.cutOrderIds],
    cutOrderNos: (record.cutOrderNos && record.cutOrderNos.length ? [...record.cutOrderNos] : cutOrderRows.map((row) => row.cutOrderNo)) || [],
    markerPlanId: record.markerPlanId || "",
    markerPlanNo: record.markerPlanNo || "",
    productionOrderNos: Array.from(new Set(cutOrderRows.map((row) => row.productionOrderNo))),
    styleCode: record.styleCode || cutOrderRows[0]?.styleCode || "",
    spuCode: record.spuCode || cutOrderRows[0]?.spuCode || "",
    techPackSpuCode: (Array.from(new Set(cutOrderRows.map((row) => row.techPackSpuCode).filter(Boolean))).length === 1 ? Array.from(new Set(cutOrderRows.map((row) => row.techPackSpuCode).filter(Boolean)))[0] : "") || record.techPackSpuCode || "",
    styleName: cutOrderRows[0]?.styleName || "",
    materialSkuSummary: record.materialSkuSummary || cutOrderRows[0]?.materialSkuSummary || "",
    materialPrepRows: cutOrderRows
  };
}
function resolveSeededMarkerForContext(context, markers) {
  if (!context) return null;
  return markers.find((item) => {
    if (context.contextType === "marker-plan-ref" && context.markerPlanId) {
      return item.contextType === "marker-plan-ref" && item.markerPlanId === context.markerPlanId;
    }
    if (!context.cutOrderIds.length) return false;
    return context.cutOrderIds.some((id) => item.cutOrderIds.includes(id));
  }) || null;
}
function buildCreatePayloadFromContext(context, marker) {
  return {
    markerId: marker?.markerId,
    markerNo: marker?.markerNo,
    cutOrderId: context?.contextType === "cut-order" ? context.cutOrderIds[0] || void 0 : state.prefilter?.cutOrderId,
    cutOrderNo: context?.contextType === "cut-order" ? context.cutOrderNos[0] || void 0 : state.prefilter?.cutOrderNo,
    markerPlanId: context?.contextType === "marker-plan-ref" ? context.markerPlanId || void 0 : state.prefilter?.markerPlanId,
    markerPlanNo: context?.contextType === "marker-plan-ref" ? context.markerPlanNo || void 0 : state.prefilter?.markerPlanNo,
    productionOrderNo: context?.productionOrderNos[0] || state.prefilter?.productionOrderNo,
    styleCode: marker?.styleCode || context?.styleCode || state.prefilter?.styleCode || void 0,
    materialSku: marker?.materialSkuSummary?.split(" / ")[0] || context?.materialSkuSummary || state.prefilter?.materialSku || void 0
  };
}
function nextSpreadingDraftIdentity() {
  const now = Date.now();
  return {
    spreadingSessionId: `spreading-${now}`,
    sessionNo: `PB-${String(now).slice(-6)}`
  };
}
function createImportedSpreadingDraft(marker, options) {
  const context = buildImportContextFromMarker(marker);
  if (!context) return null;
  const draft2 = cloneSpreadingSession(
    createSpreadingDraftFromMarker(marker, context, /* @__PURE__ */ new Date(), {
      baseSession: options?.baseSession || null,
      reimported: options?.reimported,
      importNote: options?.importNote
    })
  );
  if (!options?.baseSession) {
    const identity = nextSpreadingDraftIdentity();
    draft2.spreadingSessionId = identity.spreadingSessionId;
    draft2.sessionNo = identity.sessionNo;
  }
  return draft2;
}
function buildNewSpreadingDraft() {
  const data = readMarkerSpreadingPrototypeData();
  const params = getSearchParams();
  const markerId = params.get("markerId");
  const exceptionEntry = params.get("exceptionEntry") === "1";
  const existingMarker = markerId ? data.store.markers.find((item) => item.markerId === markerId) || null : null;
  const context = exceptionEntry ? getDefaultMarkerSpreadingContext(data.rows, data.markerPlanRefs, state.prefilter) : null;
  const seededMarker = existingMarker || (exceptionEntry ? buildMarkerSeedDraft(context, null) : null);
  if (!seededMarker) {
    return {
      spreadingSessionId: `spreading-${Date.now()}`,
      sessionNo: `PB-${String(Date.now()).slice(-6)}`,
      contextType: context?.contextType || "cut-order",
      cutOrderIds: context?.cutOrderIds ? [...context.cutOrderIds] : [],
      markerPlanId: context?.markerPlanId || "",
      markerPlanNo: context?.markerPlanNo || "",
      markerId: "",
      markerNo: "",
      styleCode: context?.styleCode || "",
      spuCode: context?.spuCode || "",
      materialSkuSummary: context?.materialSkuSummary || "",
      colorSummary: "",
      spreadingMode: "normal",
      status: "DRAFT",
      importedFromMarker: false,
      plannedLayers: 0,
      actualLayers: 0,
      totalActualLength: 0,
      totalHeadLength: 0,
      totalTailLength: 0,
      totalCalculatedUsableLength: 0,
      totalRemainingLength: 0,
      operatorCount: 0,
      rollCount: 0,
      configuredLengthTotal: 0,
      claimedLengthTotal: 0,
      varianceLength: 0,
      varianceNote: "",
      actualCutPieceQty: 0,
      unitPrice: 0,
      totalAmount: 0,
      note: "\u65B0\u5EFA\u94FA\u5E03\u9700\u4ECE\u551B\u67B6\u7F16\u53F7\u8FDB\u5165\u3002",
      createdAt: "",
      updatedAt: "",
      warningMessages: ["\u6B63\u5E38\u65B0\u5EFA\u94FA\u5E03\u9700\u5148\u5173\u8054\u551B\u67B6\u7F16\u53F7\u3002"],
      sourceChannel: "MANUAL",
      sourceWritebackId: "",
      updatedFromPdaAt: "",
      rolls: [],
      operators: []
    };
  }
  const draft2 = createImportedSpreadingDraft(seededMarker) || {
    spreadingSessionId: `spreading-${Date.now()}`,
    sessionNo: `PB-${String(data.store.sessions.length + 1).padStart(4, "0")}`,
    contextType: context.contextType,
    cutOrderIds: [...context.cutOrderIds],
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    markerId: seededMarker.markerId,
    markerNo: seededMarker.markerNo || "",
    styleCode: seededMarker.styleCode || "",
    spuCode: seededMarker.spuCode || "",
    materialSkuSummary: seededMarker.materialSkuSummary || "",
    colorSummary: seededMarker.colorSummary || "",
    spreadingMode: seededMarker.markerMode,
    status: "DRAFT",
    importedFromMarker: false,
    plannedLayers: 0,
    actualLayers: 0,
    totalActualLength: 0,
    totalHeadLength: 0,
    totalTailLength: 0,
    totalCalculatedUsableLength: 0,
    totalRemainingLength: 0,
    operatorCount: 0,
    rollCount: 0,
    configuredLengthTotal: 0,
    claimedLengthTotal: 0,
    varianceLength: 0,
    varianceNote: "",
    actualCutPieceQty: 0,
    unitPrice: 0,
    totalAmount: 0,
    note: "",
    createdAt: "",
    updatedAt: "",
    warningMessages: [],
    importSource: null,
    planLineItems: [],
    highLowPlanSnapshot: null,
    theoreticalSpreadTotalLength: 0,
    theoreticalActualCutPieceQty: 0,
    importAdjustmentRequired: false,
    importAdjustmentNote: "",
    sourceChannel: "MANUAL",
    sourceWritebackId: "",
    updatedFromPdaAt: "",
    rolls: [],
    operators: []
  };
  draft2.status = "DRAFT";
  draft2.markerId = seededMarker.markerId;
  draft2.markerNo = seededMarker.markerNo || "";
  return draft2;
}
function buildContextPayloadFromSession(session) {
  const data = readMarkerSpreadingPrototypeData();
  const primaryRow = session.cutOrderIds[0] ? data.rowsById[session.cutOrderIds[0]] : null;
  return {
    spreadingSessionId: session.spreadingSessionId,
    spreadingSessionNo: session.sessionNo || session.spreadingSessionId,
    sessionId: session.spreadingSessionId,
    markerId: session.markerId || void 0,
    markerNo: session.markerNo || void 0,
    cutOrderId: session.contextType === "cut-order" ? session.cutOrderIds[0] : void 0,
    cutOrderNo: session.contextType === "cut-order" ? primaryRow?.cutOrderNo : void 0,
    markerPlanId: session.contextType === "marker-plan-ref" ? session.markerPlanId || void 0 : void 0,
    markerPlanNo: session.contextType === "marker-plan-ref" ? session.markerPlanNo || void 0 : void 0,
    styleCode: session.styleCode || primaryRow?.styleCode || void 0,
    materialSku: session.materialSkuSummary?.split(" / ")[0] || primaryRow?.materialSkuSummary || void 0
  };
}
function buildCreatePayloadFromSession(session) {
  const payload = buildContextPayloadFromSession(session);
  return {
    markerId: payload.markerId,
    cutOrderId: payload.cutOrderId,
    cutOrderNo: payload.cutOrderNo,
    markerPlanId: payload.markerPlanId,
    markerPlanNo: payload.markerPlanNo,
    productionOrderNo: session.cutOrderIds[0] ? readMarkerSpreadingPrototypeData().rowsById[session.cutOrderIds[0]]?.productionOrderNo || void 0 : void 0,
    styleCode: payload.styleCode,
    materialSku: payload.materialSku,
    tab: "spreadings"
  };
}
function getLinkedMarkerForSession(session) {
  if (!session.markerId) return null;
  return readMarkerSpreadingPrototypeData().store.markers.find((item) => item.markerId === session.markerId) || null;
}
function resolveSpreadingDerivedState(session) {
  const data = readMarkerSpreadingPrototypeData();
  const markerRecord = getLinkedMarkerForSession(session);
  const primaryRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean);
  const context = primaryRows.length ? {
    contextType: session.contextType,
    cutOrderIds: [...session.cutOrderIds],
    cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
    markerPlanId: session.markerPlanId,
    markerPlanNo: session.markerPlanNo,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    styleCode: session.styleCode || primaryRows[0].styleCode,
    spuCode: session.spuCode || primaryRows[0].spuCode,
    styleName: primaryRows[0].styleName,
    materialSkuSummary: session.materialSkuSummary || primaryRows[0].materialSkuSummary,
    materialPrepRows: primaryRows
  } : null;
  const rollSummary = summarizeSpreadingRolls(session.rolls);
  const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session);
  const markerTotalPieces = deriveSpreadingSessionGarmentQtyPerLayer(session, markerRecord);
  const warningMessages = buildSpreadingWarningMessages({
    session,
    markerTotalPieces,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0
  });
  return {
    markerRecord,
    markerTotalPieces,
    rollSummary,
    varianceSummary,
    warningMessages
  };
}
function persistMarkerSpreadingStore(store) {
  localStorage.setItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, serializeMarkerSpreadingStorage(store));
}
function parsePrefilterFromPath() {
  const params = getSearchParams();
  const drillContext = readCuttingDrillContextFromLocation(params);
  const prefilter = {
    cutOrderId: drillContext?.cutOrderId || params.get("cutOrderId") || void 0,
    cutOrderNo: drillContext?.cutOrderNo || params.get("cutOrderNo") || void 0,
    markerPlanId: drillContext?.markerPlanId || params.get("markerPlanId") || void 0,
    markerPlanNo: drillContext?.markerPlanNo || params.get("markerPlanNo") || void 0,
    productionOrderNo: drillContext?.productionOrderNo || params.get("productionOrderNo") || void 0,
    styleCode: drillContext?.styleCode || params.get("styleCode") || void 0,
    materialSku: drillContext?.materialSku || params.get("materialSku") || void 0
  };
  return Object.values(prefilter).some(Boolean) ? prefilter : null;
}
function parseListTabFromPath() {
  return "ALL";
}
function parseEditTabFromPath() {
  const tab = getSearchParams().get("tab");
  if (tab === "rolls" || tab === "operators" || tab === "variance") return tab;
  return "summary";
}
function syncStateFromPath() {
  const pathname = appStore.getState().pathname;
  if (pathname === state.querySignature) return;
  state.querySignature = pathname;
  state.drillContext = readCuttingDrillContextFromLocation(getSearchParams());
  state.prefilter = parsePrefilterFromPath();
  state.activeTab = parseListTabFromPath();
  state.keyword = "";
  state.contextNoFilter = "";
  state.sessionNoFilter = "";
  state.cutOrderFilter = "";
  state.markerPlanRefFilter = "";
  state.markerNoFilter = "";
  state.productionOrderFilter = "";
  state.styleSpuFilter = "";
  state.materialSkuFilter = "";
  state.colorFilter = "";
  state.contextTypeFilter = "ALL";
  state.spreadingModeFilter = "ALL";
  state.spreadingStageFilter = "ALL";
  state.sourceChannelFilter = "ALL";
  state.spreadingCompletionSelection = [];
  state.feedback = null;
  state.importDecision = null;
  state.spreadingEditTab = parseEditTabFromPath();
  const currentPath = getCurrentPathname();
  const data = readMarkerSpreadingPrototypeData();
  if (currentPath === getCanonicalCuttingPath("spreading-edit") || currentPath === getCanonicalCuttingPath("spreading-create")) {
    if (currentPath === getCanonicalCuttingPath("spreading-create")) {
      const previousSelectedCreateMarkerId = state.selectedCreateMarkerId;
      const previousCreateAssignments = { ...state.createAssignments };
      const previousCreateScheduleMode = state.createScheduleMode;
      const previousCreateOwnerAccountId = state.createOwnerAccountId;
      const previousCreateCuttingTableId = state.createCuttingTableId;
      const previousCreatePlannedStartAt = state.createPlannedStartAt;
      const previousCreateNote = state.createNote;
      const step = getSearchParams().get("step");
      state.createStep = step === "confirm" ? "CONFIRM_CREATE" : "SELECT_MARKER";
      state.selectedCreateMarkerId = getSearchParams().get("bedId") || getSearchParams().get("markerId") || "";
      state.selectedCreateSourceSnapshot = null;
      state.createStep = state.selectedCreateMarkerId ? state.createStep : "SELECT_MARKER";
      state.createExceptionBackfill = false;
      state.createExceptionReason = "";
      const shouldPreserveCreateState = Boolean(previousSelectedCreateMarkerId && previousSelectedCreateMarkerId === state.selectedCreateMarkerId);
      state.createOwnerAccountId = shouldPreserveCreateState ? previousCreateOwnerAccountId : "";
      state.createCuttingTableId = shouldPreserveCreateState ? previousCreateCuttingTableId : "";
      state.createScheduleMode = shouldPreserveCreateState ? previousCreateScheduleMode : "WHOLE_PLAN_ONE_TABLE";
      state.createPlannedStartAt = shouldPreserveCreateState ? previousCreatePlannedStartAt : "";
      state.createNote = shouldPreserveCreateState ? previousCreateNote : "";
      state.createAssignments = shouldPreserveCreateState ? previousCreateAssignments : {};
      state.spreadingDraft = null;
      state.spreadingCompletionSelection = [];
      state.markerDraft = null;
      return;
    }
    const sessionId = getSearchParams().get("sessionId");
    const existing = sessionId ? data.store.sessions.find((item) => item.spreadingSessionId === sessionId) || null : null;
    state.spreadingDraft = existing ? cloneSpreadingSession(existing) : buildNewSpreadingDraft();
    state.spreadingCompletionSelection = state.spreadingDraft.contextType === "marker-plan-ref" ? [...state.spreadingDraft.completionLinkage?.linkedCutOrderIds || []] : [...state.spreadingDraft.cutOrderIds];
    state.markerDraft = null;
    return;
  }
  state.spreadingDraft = null;
  state.createStep = "SELECT_MARKER";
  state.selectedCreateMarkerId = "";
  state.createExceptionBackfill = false;
  state.createExceptionReason = "";
  state.createOwnerAccountId = "";
  state.createCuttingTableId = "";
  state.createScheduleMode = "WHOLE_PLAN_ONE_TABLE";
  state.createPlannedStartAt = "";
  state.createNote = "";
  state.createAssignments = {};
  state.spreadingEditTab = "summary";
}
function matchesKeyword(keyword, values) {
  if (!keyword.trim()) return true;
  const normalized = keyword.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalized));
}
function matchesIncludesFilter(filterValue, candidates) {
  if (!filterValue.trim()) return true;
  const normalized = filterValue.trim().toLowerCase();
  return candidates.some((value) => String(value || "").toLowerCase().includes(normalized));
}
function renderStartSpreadingControls(sessionId, selectedTableId = "", selectedOwnerId = "") {
  return `
    <div class="inline-flex flex-wrap items-center gap-1" data-spreading-start-controls="true">
      <select class="h-8 min-w-28 rounded-md border bg-background px-2 text-xs" data-cutting-spreading-start-field="cuttingTableId" data-session-id="${escapeHtml(sessionId)}">
        <option value="">\u9009\u62E9\u88C1\u5E8A</option>
        ${cuttingTableResources.map((item) => `<option value="${escapeHtml(item.cuttingTableId)}" ${item.cuttingTableId === selectedTableId ? "selected" : ""}>${escapeHtml(item.cuttingTableName)}</option>`).join("")}
      </select>
      <select class="h-8 min-w-28 rounded-md border bg-background px-2 text-xs" data-cutting-spreading-start-field="ownerAccountId" data-session-id="${escapeHtml(sessionId)}">
        <option value="">\u9009\u62E9\u8D1F\u8D23\u4EBA</option>
        ${SPREADING_CREATE_OWNER_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === selectedOwnerId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
      <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium leading-5 text-white hover:bg-blue-700" data-cutting-marker-action="start-spreading-session" data-session-id="${escapeHtml(sessionId)}">\u5F00\u59CB\u94FA\u5E03</button>
      <span class="hidden text-xs text-amber-700" data-spreading-start-feedback></span>
    </div>
  `;
}
function renderSpreadingListPrimaryAction(row) {
  const stageKey = row.mainStageKey;
  const sessionId = row.spreadingSessionId;
  if (stageKey === "WAITING_START") {
    return renderStartSpreadingControls(sessionId, row.session.cuttingTableId, row.session.ownerAccountId);
  }
  if (stageKey === "IN_PROGRESS") {
    return `<button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium leading-5 text-white hover:bg-blue-700" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(sessionId)}">\u7EE7\u7EED\u94FA\u5E03</button>`;
  }
  return "";
}
function buildSpreadingMainStageFormula(label) {
  return `\u94FA\u5E03\u72B6\u6001 = ${label}`;
}
function buildSupervisorSpreadingRows(baseRows) {
  return baseRows.map((row) => {
    const dataSourceLabel = isMobileWritebackSource(row.session.sourceChannel, row.session.sourceWritebackId) ? MOBILE_SOURCE_CHANNEL : "PC";
    const mainStageMeta = deriveSpreadingListStatus(row.statusKey);
    const cuttingStatusMeta = row.session.cuttingStatus || row.statusKey === "DONE" ? deriveSpreadingCuttingStatus(row.session.cuttingStatus || "WAITING_CUTTING") : null;
    const shortageGarmentQty = row.replenishmentWarning?.shortageQty || 0;
    return {
      ...row,
      sourceMarkerLabel: row.session.markerNo || "\u5F85\u5173\u8054\u551B\u67B6\u7F16\u53F7",
      contextSummary: row.contextType === "marker-plan-ref" ? `\u551B\u67B6\u65B9\u6848 ${row.markerPlanNo || "\u5F85\u8865"} / \u88C1\u7247\u5355 ${formatQty(row.cutOrderCount)} \u5F20` : `\u88C1\u7247\u5355 ${row.cutOrderNos.join(" / ") || "\u5F85\u8865"} / \u751F\u4EA7\u5355 ${row.productionOrderNos.join(" / ") || "\u5F85\u8865"}`,
      productionOrderCount: row.productionOrderNos.length,
      plannedCutGarmentQtyFormula: row.replenishmentWarning?.plannedCutGarmentQtyFormula || `${formatQty(row.plannedCutGarmentQty)} \u4EF6 = \u03A3\uFF08\u8BA1\u5212\u5C42\u6570 \xD7 \u5355\u5C42\u6210\u8863\u4EF6\u6570\uFF09`,
      actualCutGarmentQtyFormula: row.replenishmentWarning?.actualCutGarmentQtyFormula || buildQtySumFormula(
        row.actualCutGarmentQty,
        row.session.rolls.map((roll) => (roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0)
      ),
      shortageGarmentQty,
      shortageGarmentQtyFormula: row.replenishmentWarning?.shortageGarmentQtyFormula || buildShortageQtyFormula(shortageGarmentQty, row.plannedCutGarmentQty, row.actualCutGarmentQty),
      spreadActualLengthFormula: buildSumFormula(row.spreadActualLengthM, row.session.rolls.map((roll) => roll.actualLength || 0), 2),
      dataSourceLabel,
      mainStageKey: mainStageMeta.key,
      mainStageLabel: mainStageMeta.label,
      mainStageClassName: mainStageMeta.className,
      mainStageFormula: buildSpreadingMainStageFormula(mainStageMeta.label),
      cuttingStatusKey: cuttingStatusMeta?.key || "",
      cuttingStatusLabel: cuttingStatusMeta?.label || "\u2014",
      cuttingStatusClassName: cuttingStatusMeta?.className || "bg-slate-100 text-slate-500 border border-slate-200",
      cuttingStatusFormula: cuttingStatusMeta ? `\u88C1\u526A\u72B6\u6001 = ${cuttingStatusMeta.label}` : "\u2014"
    };
  });
}
function getPageData() {
  syncStateFromPath();
  const projection = buildMarkerSpreadingProjection({
    prefilter: state.prefilter
  });
  const store = buildMarkerSpreadingPrototypeStore({
    rows: projection.rows,
    markerPlanRefs: projection.markerPlanRefs,
    stored: projection.store
  });
  const viewModel = buildMarkerSpreadingViewModel({
    rows: projection.rows,
    markerPlanRefs: projection.markerPlanRefs,
    store,
    prefilter: state.prefilter
  });
  const baseRows = buildSpreadingListViewModel({
    spreadingSessions: viewModel.spreadingSessions,
    rowsById: projection.rowsById,
    markerPlanRefs: projection.markerPlanRefs,
    markerRecords: store.markers
  });
  const supervisorRows = buildSupervisorSpreadingRows(baseRows);
  const nonStageFilteredRows = supervisorRows.filter((row) => {
    if (state.prefilter?.productionOrderNo && !row.productionOrderNos.includes(state.prefilter.productionOrderNo)) {
      return false;
    }
    if (state.prefilter?.styleCode && row.styleCode !== state.prefilter.styleCode && row.spuCode !== state.prefilter.styleCode) {
      return false;
    }
    if (state.prefilter?.materialSku && !row.materialSkuSummary.includes(state.prefilter.materialSku)) {
      return false;
    }
    if (!matchesIncludesFilter(state.contextNoFilter, [row.markerPlanNo, ...row.cutOrderNos])) {
      return false;
    }
    if (!matchesIncludesFilter(state.sessionNoFilter, [row.sessionNo])) {
      return false;
    }
    if (!matchesIncludesFilter(state.cutOrderFilter, row.cutOrderNos)) {
      return false;
    }
    if (!matchesIncludesFilter(state.markerPlanRefFilter, [row.markerPlanNo])) {
      return false;
    }
    if (!matchesIncludesFilter(state.markerNoFilter, [
      row.sourceMarkerLabel,
      row.session.sourceSchemeNo,
      row.session.sourceBedNo,
      row.session.markerNo,
      row.session.cuttingTableName,
      row.session.cuttingTableNo
    ])) {
      return false;
    }
    if (!matchesIncludesFilter(state.productionOrderFilter, row.productionOrderNos)) {
      return false;
    }
    if (!matchesIncludesFilter(state.styleSpuFilter, [row.styleCode, row.spuCode])) {
      return false;
    }
    if (!matchesIncludesFilter(state.materialSkuFilter, [row.materialSkuSummary])) {
      return false;
    }
    if (!matchesIncludesFilter(state.colorFilter, [row.colorSummary])) {
      return false;
    }
    if (state.spreadingModeFilter !== "ALL" && row.spreadingMode !== state.spreadingModeFilter) {
      return false;
    }
    if (state.contextTypeFilter !== "ALL" && row.contextType !== state.contextTypeFilter) {
      return false;
    }
    if (state.spreadingStageFilter !== "ALL" && row.mainStageKey !== state.spreadingStageFilter) {
      return false;
    }
    if (state.sourceChannelFilter !== "ALL" && row.dataSourceLabel !== state.sourceChannelFilter) {
      return false;
    }
    return matchesKeyword(state.keyword, row.keywordIndex);
  });
  const stageCounts = {
    ALL: nonStageFilteredRows.length,
    WAITING_START: nonStageFilteredRows.filter((row) => row.mainStageKey === "WAITING_START").length,
    IN_PROGRESS: nonStageFilteredRows.filter((row) => row.mainStageKey === "IN_PROGRESS").length,
    DONE: nonStageFilteredRows.filter((row) => row.mainStageKey === "DONE").length
  };
  const spreadingRows = state.activeTab === "ALL" ? nonStageFilteredRows : nonStageFilteredRows.filter((row) => row.mainStageKey === state.activeTab);
  return {
    rows: projection.rows,
    rowsById: projection.rowsById,
    markerPlanRefs: projection.markerPlanRefs,
    markerPlanRefsById: projection.markerPlanRefsById,
    store,
    projection,
    viewModel,
    spreadingRows,
    stageCounts
  };
}
function getSpreadingRow(sessionId) {
  if (!sessionId) return null;
  return getPageData().spreadingRows.find((item) => item.spreadingSessionId === sessionId) || null;
}
function getStoredSpreadingSession(sessionId) {
  if (!sessionId) return null;
  return readMarkerSpreadingPrototypeData().store.sessions.find((item) => item.spreadingSessionId === sessionId) || null;
}
function syncImportedFieldsToExistingSession(marker, baseSession) {
  const draft2 = createImportedSpreadingDraft(marker, {
    baseSession,
    reimported: true,
    importNote: "\u4EC5\u540C\u6B65\u551B\u67B6\u7406\u8BBA\u5B57\u6BB5\uFF0C\u4E0D\u8986\u76D6\u5DF2\u6709\u5377\u8BB0\u5F55\u548C\u4EBA\u5458\u8BB0\u5F55\u3002"
  });
  if (!draft2) return null;
  draft2.status = baseSession.status;
  return draft2;
}
function renderImportDecisionPanel() {
  return "";
}
function renderHeaderActions(actions) {
  return `<div class="flex flex-wrap gap-2">${actions.join("")}</div>`;
}
function renderFeedbackBar() {
  if (!state.feedback) return "";
  const className = state.feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return `<section class="rounded-lg border px-3 py-3 text-sm ${className}">${escapeHtml(state.feedback.message)}</section>`;
}
function renderPrefilterBar() {
  const labels = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter?.cutOrderNo ? `\u88C1\u7247\u5355\uFF1A${state.prefilter.cutOrderNo}` : "",
      state.prefilter?.markerPlanNo ? `\u551B\u67B6\u65B9\u6848\uFF1A${state.prefilter.markerPlanNo}` : "",
      state.prefilter?.styleCode ? `\u6B3E\u53F7\uFF1A${state.prefilter.styleCode}` : "",
      state.prefilter?.materialSku ? `\u9762\u6599 SKU\uFF1A${state.prefilter.materialSku}` : ""
    ].filter(Boolean))
  );
  if (!labels.length) return "";
  return `
    <div data-testid="cutting-spreading-prefilter-bar">
      ${renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || "\u5F53\u524D\u5217\u8868\u5DF2\u627F\u63A5\u4E0A\u6E38\u4E0A\u4E0B\u6587\u9884\u7B5B",
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-marker-action="clear-prefilter"', "amber")),
    clearAttrs: 'data-cutting-marker-action="clear-prefilter"'
  })}
    </div>
  `;
}
function getSpreadingStageOptions() {
  return [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "WAITING_START", label: "\u5F85\u94FA\u5E03" },
    { value: "IN_PROGRESS", label: "\u94FA\u5E03\u4E2D" },
    { value: "DONE", label: "\u5DF2\u94FA\u5E03" }
  ];
}
function getSpreadingStageLabel(stage) {
  return getSpreadingStageOptions().find((item) => item.value === stage)?.label || "\u5168\u90E8";
}
function buildSpreadingStageCountFormula(label) {
  return `${label}\u6570 = \u94FA\u5E03\u72B6\u6001 = ${label} \u7684\u94FA\u5E03\u5355\u6570`;
}
function buildCurrentListExportRows(rows) {
  const tabLabel = getSpreadingStageLabel(state.activeTab);
  const now = /* @__PURE__ */ new Date();
  const timestamp = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, "0"),
    `${now.getDate()}`.padStart(2, "0"),
    `${now.getHours()}`.padStart(2, "0"),
    `${now.getMinutes()}`.padStart(2, "0"),
    `${now.getSeconds()}`.padStart(2, "0")
  ].join("");
  return {
    filename: `\u94FA\u5E03\u5355-${tabLabel}-${timestamp}.csv`,
    rows: [
      [
        "\u94FA\u5E03\u7F16\u53F7",
        "\u94FA\u5E03\u72B6\u6001",
        "\u88C1\u526A\u72B6\u6001",
        "\u6765\u6E90\u551B\u67B6\u7F16\u53F7",
        "\u88C1\u5E8A",
        "\u8D1F\u8D23\u4EBA",
        "\u5F00\u59CB\u65F6\u95F4",
        "\u7ED3\u675F\u65F6\u95F4",
        "\u88C1\u526A\u65F6\u95F4",
        "\u9884\u8BA1\u8017\u65F6",
        "\u4E0A\u4E0B\u6587\u6458\u8981",
        "\u88C1\u7247\u5355\u6570\uFF08\u5F20\uFF09",
        "\u751F\u4EA7\u5355\u6570\uFF08\u5355\uFF09",
        "\u94FA\u5E03\u6A21\u5F0F",
        "\u8BA1\u5212\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        "\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        "\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        "\u603B\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09",
        "\u6700\u8FD1\u66F4\u65B0\u65F6\u95F4"
      ],
      ...rows.map((row) => [
        row.sessionNo,
        row.mainStageLabel,
        row.cuttingStatusLabel,
        row.session.sourceBedNo || row.sourceMarkerLabel,
        row.session.cuttingTableName || row.session.cuttingTableNo || "\u672A\u6392\u7A0B",
        row.session.ownerName || "\u672A\u5206\u914D",
        formatScheduleDateTime(row.session.actualStartAt),
        formatScheduleDateTime(row.session.actualEndAt),
        `\u5F00\u59CB\uFF1A${formatScheduleDateTime(row.session.cuttingStartedAt)} / \u7ED3\u675F\uFF1A${formatScheduleDateTime(row.session.cuttingFinishedAt)}`,
        `${row.session.estimatedDurationMinutes || 45} \u5206\u949F`,
        row.contextSummary,
        row.cutOrderCount,
        row.productionOrderCount,
        deriveSpreadingModeMeta(row.spreadingMode).label,
        row.plannedCutGarmentQty,
        row.actualCutGarmentQty,
        row.shortageGarmentQty,
        Number(row.spreadActualLengthM).toFixed(2),
        formatDateText(row.updatedAt)
      ])
    ]
  };
}
function renderFilterArea() {
  return renderStickyFilterShell(`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
        ${renderListTextInput("\u641C\u7D22", state.keyword, 'data-cutting-spreading-list-field="keyword"', "\u94FA\u5E03\u5355 / \u551B\u67B6\u65B9\u6848 / \u551B\u67B6\u7F16\u53F7 / \u751F\u4EA7\u5355 / \u6B3E\u5F0F")}
        ${renderListSelect("\u94FA\u5E03\u72B6\u6001", state.spreadingStageFilter, 'data-cutting-spreading-list-field="main-stage"', [
    { value: "ALL", label: "\u5168\u90E8" },
    ...getSpreadingStageOptions().filter((item) => item.value !== "ALL")
  ])}
        ${renderListTextInput("\u751F\u4EA7\u5355 / \u88C1\u7247\u5355", state.contextNoFilter, 'data-cutting-spreading-list-field="context-no"', "")}
        ${renderListTextInput("\u6B3E\u5F0F / SPU", state.styleSpuFilter, 'data-cutting-spreading-list-field="style-spu"', "")}
        ${renderListTextInput("\u88C1\u5E8A", state.markerNoFilter, 'data-cutting-spreading-list-field="marker-no"', "\u88C1\u5E8A\u540D\u79F0 / \u551B\u67B6\u65B9\u6848")}
        <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-cutting-marker-action="clear-filters">\u91CD\u7F6E\u7B5B\u9009</button>
      </div>
    `, "", 'data-testid="cutting-spreading-list-filters"');
}
function renderListTabs() {
  const { stageCounts } = getPageData();
  return `
    <section class="rounded-lg border border-dashed bg-muted/20 px-3 py-3" data-testid="cutting-spreading-stage-tabs">
      <div class="flex flex-wrap gap-2">
        ${getSpreadingStageOptions().map((tab) => {
    const active = state.activeTab === tab.value;
    return `
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-sm leading-5 ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "hover:bg-muted"}"
                data-cutting-marker-action="switch-spreading-list-tab"
                data-list-tab="${tab.value}"
              >
                ${escapeHtml(tab.label)}\uFF08${formatQty(stageCounts[tab.value])}\uFF09
              </button>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderListStats() {
  const { stageCounts } = getPageData();
  return `
    <section class="grid gap-3 md:grid-cols-3" data-testid="cutting-spreading-list-stats">
      ${renderCompactKpiCard("\u5F85\u94FA\u5E03\u6570", stageCounts.WAITING_START, "", "text-slate-900", buildSpreadingStageCountFormula("\u5F85\u94FA\u5E03"))}
      ${renderCompactKpiCard("\u94FA\u5E03\u4E2D\u6570", stageCounts.IN_PROGRESS, "", "text-amber-600", buildSpreadingStageCountFormula("\u94FA\u5E03\u4E2D"))}
      ${renderCompactKpiCard("\u5DF2\u94FA\u5E03\u6570", stageCounts.DONE, "", "text-emerald-600", buildSpreadingStageCountFormula("\u5DF2\u94FA\u5E03"))}
    </section>
  `;
}
function renderContextCell(contextLabel, cutOrderNos, markerPlanNo) {
  return `
    <div class="space-y-1">
      <p class="text-xs font-medium text-foreground">${escapeHtml(contextLabel)}</p>
      <p class="text-[11px] text-muted-foreground">\u88C1\u7247\u5355 ${escapeHtml(String(cutOrderNos.length))} \u4E2A</p>
      ${markerPlanNo ? `<p class="text-[11px] text-muted-foreground">\u551B\u67B6\u65B9\u6848\uFF1A${escapeHtml(markerPlanNo)}</p>` : ""}
    </div>
  `;
}
function renderMarkerTable(rows) {
  void rows;
  return "";
}
function renderSpreadingListCuttingAction(row) {
  if (row.cuttingStatusKey === "WAITING_CUTTING") {
    return `<button type="button" class="rounded-md border border-violet-500 bg-violet-50 px-3 py-1.5 text-xs leading-5 text-violet-700 hover:bg-violet-100" data-cutting-marker-action="start-cutting" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u5F00\u59CB\u88C1\u526A</button>`;
  }
  if (row.cuttingStatusKey === "CUTTING") {
    return `<button type="button" class="rounded-md border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs leading-5 text-emerald-700 hover:bg-emerald-100" data-cutting-marker-action="finish-cutting" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u5B8C\u6210\u88C1\u526A</button>`;
  }
  return "";
}
function renderSpreadingTable(rows, projection) {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground" data-cutting-spreading-main-card="true">\u5F53\u524D\u7B5B\u9009\u8303\u56F4\u5185\u6682\u65E0\u94FA\u5E03\u8BB0\u5F55\u3002</section>';
  }
  return `
    <section class="rounded-lg border bg-card" data-testid="cutting-spreading-list-table" data-cutting-spreading-main-card="true">
      <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">\u94FA\u5E03\u5355\u4E3B\u8868</h2>
        </div>
        <div class="text-xs text-muted-foreground">\u5171 ${rows.length} \u5F20\u94FA\u5E03\u5355</div>
      </div>
      <div class="divide-y">
        ${rows.map((row) => {
    const summary = resolveWebSpreadingSummary(row, projection);
    const markerNos = row.session.sourceBedNo || row.session.markerNo || row.sourceMarkerLabel;
    const pattern = summary.order?.patternIdentity || null;
    const pda = summary.pda;
    return `
              <article class="grid gap-4 px-4 py-4 text-sm xl:grid-cols-[1.1fr_1.2fr_1.4fr_1.2fr_1.2fr_1.2fr_1.2fr_1.1fr_1fr]">
                <div class="space-y-2">
                  <div class="font-semibold text-blue-600">${escapeHtml(row.sessionNo)}</div>
                  <div class="flex flex-wrap gap-1">${renderStatusBadge(summary.status.label, summary.status.className)}</div>
                  <div class="text-xs text-muted-foreground">\u551B\u67B6\u7F16\u53F7 / \u5E8A\u6B21\uFF1A${escapeHtml(markerNos || "\u5F85\u8865")}</div>
                </div>
                <div class="space-y-1 text-xs leading-5">
                  <div class="text-sm font-medium text-foreground">${escapeHtml(row.session.sourceSchemeNo || row.markerPlanNo || "\u5F85\u5173\u8054\u551B\u67B6\u65B9\u6848")}</div>
                  <div class="text-muted-foreground">\u751F\u4EA7\u5355\uFF1A${escapeHtml(row.productionOrderNos.join(" / ") || "\u5F85\u8865")}</div>
                  <div class="text-muted-foreground">\u6765\u6E90\u88C1\u7247\u5355\uFF1A${escapeHtml(`${formatQty(summary.order?.sourceCutOrderIds.length || row.cutOrderCount)} \u5F20`)}</div>
                </div>
                <div>
                  ${renderMaterialIdentityBlock(
      summary.order?.materialIdentity || {
        materialSku: row.materialSkuSummary || "\u5F85\u8865",
        materialLabel: "\u94FA\u5E03\u9762\u6599",
        materialColor: row.colorSummary,
        materialAlias: row.materialAliasSummary,
        materialImageUrl: row.materialImageUrl
      },
      { compact: true, imageSizeClass: "h-9 w-9", showCategory: false }
    )}
                </div>
                <div class="space-y-1 text-xs leading-5">
                  <div class="font-medium text-foreground">${escapeHtml(pattern?.patternFileName || "\u7EB8\u6837\u5F85\u8865")}</div>
                  <div class="text-muted-foreground">\u7248\u672C\uFF1A${escapeHtml(pattern?.patternVersion || "\u5F85\u8865")}</div>
                  <div class="text-muted-foreground">\u6709\u6548\u5E45\u5BBD\uFF1A${escapeHtml(pattern?.effectiveWidthText || summary.order?.effectiveWidth || "\u5F85\u8865")}</div>
                </div>
                <div>
                  ${renderCompactMetricLines([
      ["\u8BA1\u5212\u5C42\u6570", `${formatQty(summary.plannedLayerCount)} \u5C42`],
      ["\u8BA1\u5212\u7528\u91CF", formatLength(summary.plannedUsage)],
      ["\u8BA1\u5212\u6570\u91CF", `${formatQty(summary.plannedQty)} \u4EF6`]
    ])}
                </div>
                <div>
                  ${renderCompactMetricLines([
      ["\u5B9E\u94FA\u5C42\u6570", `${formatQty(summary.actualLayerCount)} \u5C42`],
      ["\u5B9E\u9645\u7528\u91CF", formatLength(summary.actualUsage)],
      ["\u5B9E\u9645\u88C1\u526A\u6570\u91CF", `${formatQty(summary.actualCutQty)} \u4EF6`]
    ])}
                </div>
                <div>
                  ${renderCompactMetricLines([
      ["\u5C42\u6570\u5DEE\u5F02", formatSignedNumber(summary.layerDiff, "\u5C42")],
      ["\u7528\u91CF\u5DEE\u5F02", formatSignedLength(summary.usageDiff)],
      ["\u6570\u91CF\u5DEE\u5F02", formatSignedNumber(summary.qtyDiff, "\u4EF6")]
    ])}
                  <div class="mt-2">${renderStatusBadge(summary.needsReview ? "\u9700\u8981\u590D\u6838" : "\u65E0\u9700\u590D\u6838", summary.needsReview ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}</div>
                </div>
                <div class="space-y-1 text-xs leading-5">
                  ${renderStatusBadge(pda.statusLabel, pda.statusClassName)}
                  <div class="text-muted-foreground">\u6700\u8FD1\u5199\u56DE\uFF1A${escapeHtml(formatScheduleDateTime(pda.latestAt))}</div>
                  <div class="text-muted-foreground">\u5199\u56DE\u4EBA\uFF1A${escapeHtml(pda.operatorName)}</div>
                </div>
                <div class="flex flex-col gap-1">
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-marker-action="open-spreading-detail" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u67E5\u770B\u8BE6\u60C5</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-marker-action="open-spreading-detail" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u590D\u6838</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-marker-action="open-spreading-detail" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u67E5\u770B PDA \u8BB0\u5F55</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u5904\u7406\u5DEE\u5F02</button>
                </div>
              </article>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderSpreadingSupervisorListPage() {
  const pathname = getCurrentPathname();
  const meta = getCanonicalCuttingMeta(pathname, "spreading-list");
  const pageData = getPageData();
  const filteredRows = pageData.spreadingRows;
  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-list-page">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: renderHeaderActions(appendSummaryReturnAction([
      '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="export-spreading-list">\u5BFC\u51FA\u5F53\u524D\u89C6\u56FE</button>'
    ]))
  })}
      ${renderFeedbackBar()}
      ${renderListStats()}
      ${renderListTabs()}
      ${renderFilterArea()}
      ${renderSpreadingTable(filteredRows, pageData.projection)}
    </div>
  `;
}
function renderMarkerWarningSection(warningMessages) {
  return renderSection(
    "\u63D0\u9192\u533A",
    warningMessages.length ? `
          <div class="space-y-2">
            ${warningMessages.map(
      (message) => `
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm text-amber-700">${escapeHtml(message)}</div>
                `
    ).join("")}
          </div>
        ` : '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">\u5F53\u524D\u672A\u8BC6\u522B\u660E\u663E\u5F02\u5E38\uFF0C\u53EF\u7EE7\u7EED\u7EF4\u62A4\u551B\u67B6\u6570\u636E\u3002</div>'
  );
}
function formatLayerValue(value) {
  return value === null || value === void 0 || Number.isNaN(value) ? "\u5F85\u8865\u5F55" : String(value);
}
function formatHandledLengthValue(value) {
  return value === null || value === void 0 || Number.isNaN(value) ? "\u5F85\u8865\u5F55" : formatLength(value);
}
function renderOperatorAllocationSummary(summary) {
  if (!summary.rows.length) {
    return '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">\u5F53\u524D\u5C1A\u672A\u5F62\u6210\u6309\u4EBA\u5206\u644A\u6570\u636E\uFF0C\u5F85\u8865\u5F55\u5C42\u6570\u3001\u957F\u5EA6\u548C\u5355\u4EF7\u540E\u81EA\u52A8\u6C47\u603B\u3002</div>';
  }
  return `
    <div class="space-y-3">
      ${renderInfoGrid([
    { label: "\u6309\u4EBA\u5206\u644A\u4EBA\u6570", value: `${formatQty(summary.rows.length)} \u4EBA` },
    { label: "\u603B\u8D1F\u8D23\u5C42\u6570\uFF08\u5C42\uFF09", value: `${formatQty(summary.totalHandledLayerCount)} \u5C42` },
    { label: "\u603B\u8D1F\u8D23\u957F\u5EA6", value: formatHandledLengthValue(summary.totalHandledLength) },
    { label: "\u603B\u8D1F\u8D23\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", value: `${formatQty(summary.totalHandledPieceQty)} \u4EF6` },
    { label: "\u4EBA\u5458\u91D1\u989D\u5408\u8BA1", value: formatCurrency(summary.totalDisplayAmount) },
    { label: "\u4EBA\u5DE5\u8C03\u6574\u91D1\u989D", value: summary.hasManualAdjustedAmount ? "\u5B58\u5728\u4EBA\u5DE5\u8C03\u6574" : "\u672A\u4EBA\u5DE5\u8C03\u6574" }
  ])}
      <div class="overflow-auto">
        <table class="w-full min-w-[880px] text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-3">\u4EBA\u5458\u59D3\u540D</th>
              <th class="px-3 py-3">\u8D1F\u8D23\u5C42\u6570\u5408\u8BA1\uFF08\u5C42\uFF09</th>
              <th class="px-3 py-3">\u8D1F\u8D23\u957F\u5EA6\u5408\u8BA1</th>
              <th class="px-3 py-3">\u8D1F\u8D23\u6210\u8863\u4EF6\u6570\u5408\u8BA1\uFF08\u4EF6\uFF09</th>
              <th class="px-3 py-3">\u91D1\u989D\u5408\u8BA1</th>
              <th class="px-3 py-3">\u4EBA\u5DE5\u8C03\u6574</th>
            </tr>
          </thead>
          <tbody>
            ${summary.rows.map(
    (row) => `
                  <tr class="border-b">
                    <td class="px-3 py-3">${escapeHtml(row.operatorName)}</td>
                    <td class="px-3 py-3">${escapeHtml(`${formatQty(row.handledLayerCountTotal)} \u5C42`)}</td>
                    <td class="px-3 py-3">${escapeHtml(formatHandledLengthValue(row.handledLengthTotal))}</td>
                    <td class="px-3 py-3">${escapeHtml(`${formatQty(row.handledGarmentQtyTotal ?? row.handledPieceQtyTotal)} \u4EF6`)}</td>
                    <td class="px-3 py-3">${escapeHtml(formatCurrency(row.displayAmountTotal))}</td>
                    <td class="px-3 py-3">${escapeHtml(row.hasManualAdjustedAmount ? "\u5DF2\u8C03\u6574" : "\u672A\u8C03\u6574")}</td>
                  </tr>
                `
  ).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function renderOperatorAmountWarningSection(warningMessages) {
  if (!warningMessages.length) {
    return '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">\u5F53\u524D\u6309\u4EBA\u5206\u644A\u91D1\u989D\u5B57\u6BB5\u5B8C\u6574\uFF0C\u672A\u8BC6\u522B\u660E\u663E\u91D1\u989D\u5F02\u5E38\u3002</div>';
  }
  return `
    <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
      <p class="font-medium">\u91D1\u989D\u63D0\u9192</p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        ${warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}
      </ul>
    </div>
  `;
}
function buildRollHandoverSummaryMap(session, markerTotalPieces) {
  return Object.fromEntries(
    session.rolls.map((roll) => [
      roll.rollRecordId,
      buildRollHandoverViewModel(
        roll,
        session.operators.filter((operator) => operator.rollRecordId === roll.rollRecordId),
        markerTotalPieces
      )
    ])
  );
}
function renderRollHandoverStatus(summary) {
  const tags = [];
  if (summary.hasHandover) {
    tags.push(renderTag("\u6709\u4EA4\u63A5\u73ED", "bg-blue-100 text-blue-700 border border-blue-200"));
  } else {
    tags.push(renderTag("\u65E0\u4EA4\u63A5\u73ED", "bg-slate-100 text-slate-700 border border-slate-200"));
  }
  if (summary.hasWarnings) {
    tags.push(renderTag("\u4EA4\u63A5\u5F02\u5E38", "bg-amber-100 text-amber-700 border border-amber-200"));
  } else {
    tags.push(renderTag("\u4EA4\u63A5\u6B63\u5E38", "bg-emerald-100 text-emerald-700 border border-emerald-200"));
  }
  return `<div class="flex flex-wrap gap-2">${tags.join("")}</div>`;
}
function renderRollHandoverWarnings(summary) {
  if (!summary.warnings.length) {
    return '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">\u5F53\u524D\u5377\u7684\u5C42\u6570\u3001\u957F\u5EA6\u4E0E\u4EA4\u63A5\u533A\u95F4\u5DF2\u5F62\u6210\u53EF\u8FFD\u6EAF\u95ED\u73AF\u3002</div>';
  }
  return `
    <div class="space-y-2">
      ${summary.warnings.map(
    (warning) => `
            <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">${escapeHtml(warning)}</div>
          `
  ).join("")}
    </div>
  `;
}
function buildSpreadingCompletionTargetIds(session) {
  if (session.contextType === "marker-plan-ref") return [...state.spreadingCompletionSelection];
  return [...session.cutOrderIds];
}
function buildSpreadingReplenishmentPreview(session, linkedCutOrderNos, derived) {
  const data = readMarkerSpreadingPrototypeData();
  const primaryRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean);
  const context = primaryRows.length > 0 ? {
    contextType: session.contextType,
    cutOrderIds: [...session.cutOrderIds],
    cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
    markerPlanId: session.markerPlanId,
    markerPlanNo: session.markerPlanNo,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    styleCode: session.styleCode || primaryRows[0].styleCode,
    spuCode: session.spuCode || primaryRows[0].spuCode,
    styleName: primaryRows[0].styleName,
    materialSkuSummary: session.materialSkuSummary || primaryRows[0].materialSkuSummary,
    materialPrepRows: primaryRows
  } : null;
  const derivedWarning = buildSpreadingReplenishmentWarning({
    context,
    session,
    markerTotalPieces: derived.markerTotalPieces,
    cutOrderNos: linkedCutOrderNos,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    materialAttr: primaryRows[0]?.materialLabel || primaryRows[0]?.materialCategory || "",
    warningMessages: derived.warningMessages
  });
  return session.replenishmentWarning?.handled ? { ...derivedWarning, handled: true } : derivedWarning;
}
function renderSpreadingReplenishmentSection(session, warning, actionLabel = "\u53BB\u8865\u6599\u7BA1\u7406") {
  const toneClass = warning.warningLevel === "\u9AD8" ? "border-rose-200 bg-rose-50 text-rose-700" : warning.warningLevel === "\u4E2D" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return renderSection(
    "\u8865\u6599\u9884\u8B66\u533A",
    `
        <div class="space-y-3">
          <div class="rounded-md border px-3 py-3 text-sm ${toneClass}">
            \u5F53\u524D\u9884\u8B66\u7B49\u7EA7\uFF1A${escapeHtml(warning.warningLevel)}\uFF0C\u5EFA\u8BAE\u52A8\u4F5C\uFF1A${escapeHtml(warning.suggestedAction)}
          </div>
          ${renderInfoGrid([
      {
        label: "\u8BA1\u5212\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(warning.plannedCutGarmentQty)} \u4EF6`,
        formula: warning.plannedCutGarmentQtyFormula
      },
      {
        label: "\u7406\u8BBA\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(warning.theoreticalCutGarmentQty)} \u4EF6`,
        formula: warning.theoreticalCutGarmentQtyFormula
      },
      {
        label: "\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(warning.actualCutGarmentQty)} \u4EF6`,
        formula: warning.actualCutGarmentQtyFormula
      },
      { label: "\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u603B\u957F\u5EA6\uFF08m\uFF09", value: formatLength(warning.configuredLengthTotal) },
      { label: "\u88C1\u5E8A\u5DF2\u9886\u603B\u957F\u5EA6\uFF08m\uFF09", value: formatLength(warning.claimedLengthTotal) },
      { label: "\u603B\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09", value: formatLength(warning.spreadActualLengthM) },
      {
        label: "\u603B\u53EF\u7528\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(warning.spreadUsableLengthM),
        formula: warning.spreadUsableLengthFormula
      },
      {
        label: "\u5DEE\u5F02\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(warning.varianceLength),
        formula: warning.varianceLengthFormula
      },
      {
        label: "\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(warning.shortageGarmentQty)} \u4EF6`,
        formula: warning.shortageGarmentQtyFormula
      },
      { label: "\u5EFA\u8BAE\u52A8\u4F5C", value: warning.suggestedAction },
      { label: "\u5224\u5B9A\u4F9D\u636E", value: warning.suggestedActionRuleText }
    ])}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">${escapeHtml(actionLabel)}</button>
        </div>
      </div>
    `
  );
}
function renderSpreadingCompletionLinkageSection(session, linkedCutOrderNos) {
  const data = readMarkerSpreadingPrototypeData();
  const selectionIds = buildSpreadingCompletionTargetIds(session);
  const rows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean).map((row) => ({
    id: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
    materialSummary: `${row.color} / ${row.materialSkuSummary}`,
    spreadingProgress: buildMarkerSpreadingCountsByCutOrder(row.cutOrderId).statusSummary,
    selected: selectionIds.includes(row.cutOrderId)
  }));
  return renderSection(
    "\u72B6\u6001\u8054\u52A8\u533A",
    session.contextType === "marker-plan-ref" ? `
          <div class="space-y-3">
            <div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
              \u5F53\u524D\u4E3A\u551B\u67B6\u65B9\u6848\u4E0A\u4E0B\u6587\u3002\u5B8C\u6210\u94FA\u5E03\u65F6\uFF0C\u53EA\u8BB0\u5F55\u52FE\u9009\u88C1\u7247\u5355\u7684\u7D2F\u8BA1\u94FA\u5E03\u8FDB\u5EA6\uFF1B\u672A\u52FE\u9009\u4EFB\u4F55\u9879\u65F6\u4E0D\u5141\u8BB8\u5B8C\u6210\u3002
            </div>
            <div class="space-y-2">
              ${rows.map(
      (row) => `
                    <label class="flex items-start gap-3 rounded-md border px-3 py-3">
                      <input type="checkbox" class="mt-1 size-4" ${row.selected ? "checked" : ""} data-cutting-marker-action="toggle-spreading-completion-order" data-cut-order-id="${escapeHtml(row.id)}" />
                      <div class="space-y-1">
                        <p class="text-sm font-medium text-foreground">${escapeHtml(row.cutOrderNo)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(row.materialSummary)}</p>
                        <p class="text-xs text-muted-foreground">\u7D2F\u8BA1\u94FA\u5E03\u8FDB\u5EA6\uFF1A${escapeHtml(row.spreadingProgress)}</p>
                      </div>
                    </label>
                  `
    ).join("")}
            </div>
            <div class="rounded-md border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
              \u672C\u6B21\u9884\u8BA1\u8BA1\u5165 ${escapeHtml(String(selectionIds.length))} \u4E2A\u88C1\u7247\u5355\u7684\u7D2F\u8BA1\u8FDB\u5EA6\u3002
            </div>
          </div>
        ` : renderInfoGrid([
      { label: "\u672C\u94FA\u5E03\u5355\u72B6\u6001", value: deriveSpreadingStatus(session.status).label },
      { label: "\u8054\u52A8\u66F4\u65B0\u5BF9\u8C61", value: linkedCutOrderNos.join(" / ") || "\u5F85\u8865" },
      { label: "\u8054\u52A8\u89C4\u5219", value: "\u5B8C\u6210\u94FA\u5E03\u540E\u53EA\u8BB0\u5F55\u672C\u94FA\u5E03\u5355\u548C\u7D2F\u8BA1\u8FDB\u5EA6\uFF0C\u4E0D\u6539\u53D8\u88C1\u7247\u5355\u4E3B\u72B6\u6001\u3002" }
    ])
  );
}
function renderSpreadingImportSourceSection(session, linkedCutOrderNos) {
  const source = session.importSource;
  const data = readMarkerSpreadingPrototypeData();
  const sourceRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean);
  const linkedMarker = getLinkedMarkerForSession(session);
  const importedVarianceSummary = buildSpreadingVarianceSummary(
    sourceRows.length ? {
      contextType: session.contextType,
      cutOrderIds: [...session.cutOrderIds],
      cutOrderNos: sourceRows.map((row) => row.cutOrderNo),
      markerPlanId: session.markerPlanId,
      markerPlanNo: session.markerPlanNo,
      productionOrderNos: Array.from(new Set(sourceRows.map((row) => row.productionOrderNo))),
      styleCode: session.styleCode || sourceRows[0].styleCode,
      spuCode: session.spuCode || sourceRows[0].spuCode,
      styleName: sourceRows[0].styleName,
      materialSkuSummary: session.materialSkuSummary || sourceRows[0].materialSkuSummary,
      materialPrepRows: sourceRows
    } : null,
    linkedMarker,
    session
  );
  const rollLayerTotal = summarizeSpreadingRolls(session.rolls || []).totalLayers;
  const actualLayerTotal = Number(session.actualLayers || 0);
  const markerTotalPieces = deriveSpreadingSessionGarmentQtyPerLayer(session, linkedMarker);
  const theoreticalCutGarmentQty = importedVarianceSummary?.theoreticalCutGarmentQty || session.theoreticalActualCutPieceQty || 0;
  const theoreticalCutGarmentQtyFormula = importedVarianceSummary?.theoreticalCutGarmentQtyFormula || buildTheoreticalCutGarmentQtyFormula(theoreticalCutGarmentQty, rollLayerTotal, actualLayerTotal, markerTotalPieces);
  return renderSection(
    "\u5BFC\u5165\u6765\u6E90\u533A",
    source ? renderInfoGrid([
      { label: "\u6765\u6E90\u551B\u67B6\u7F16\u53F7", value: session.sourceBedNo || source.sourceMarkerNo || session.markerNo || "\u5F85\u8865" },
      { label: "\u88C1\u5E8A", value: session.cuttingTableName || session.cuttingTableNo || "\u672A\u6392\u7A0B" },
      { label: "\u5B9E\u9645\u5F00\u59CB\u65F6\u95F4", value: session.actualStartAt || "\u672A\u5F00\u59CB" },
      { label: "\u5B9E\u9645\u7ED3\u675F\u65F6\u95F4", value: session.actualEndAt || "\u672A\u5B8C\u6210" },
      { label: "\u9884\u8BA1\u8017\u65F6", value: `${session.estimatedDurationMinutes || 45} \u5206\u949F` },
      { label: "\u88C1\u5E8A\u6392\u7A0B", value: session.tableScheduleStatus || "\u672A\u6392\u7A0B" },
      { label: "\u6765\u6E90\u6A21\u5F0F", value: deriveSpreadingModeMeta(source.sourceMarkerMode).label },
      { label: "\u5173\u8054\u88C1\u7247\u5355", value: source.sourceCutOrderNos.join(" / ") || linkedCutOrderNos.join(" / ") || "\u5F85\u8865" },
      { label: "\u5173\u8054\u551B\u67B6\u65B9\u6848", value: source.sourceMarkerPlanNo || "\u672A\u5173\u8054\u551B\u67B6\u65B9\u6848" },
      { label: "\u5BFC\u5165\u65F6\u95F4", value: formatDateText(source.importedAt) },
      { label: "\u91CD\u65B0\u5BFC\u5165", value: source.reimported ? "\u662F" : "\u5426" },
      { label: "\u5BFC\u5165\u8BB0\u5F55", value: source.importNote || "\u7531\u551B\u67B6\u6A21\u677F\u5BFC\u5165\u94FA\u5E03\u8349\u7A3F" },
      {
        label: "\u7406\u8BBA\u94FA\u5E03\u603B\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(session.theoreticalSpreadTotalLength || 0),
        formula: buildSpreadingImportedLengthFormula(session.theoreticalSpreadTotalLength || 0)
      },
      {
        label: "\u7406\u8BBA\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(theoreticalCutGarmentQty)} \u4EF6`,
        formula: theoreticalCutGarmentQtyFormula
      },
      { label: "\u5BFC\u5165\u540E\u8C03\u6574", value: session.importAdjustmentRequired ? "\u5DF2\u6709\u5BFC\u5165\u540E\u8C03\u6574" : "\u5F53\u524D\u672A\u8C03\u6574" },
      { label: "\u8C03\u6574\u8BB0\u5F55", value: session.importAdjustmentNote || "\u6682\u65E0" }
    ]) : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">\u5F53\u524D\u94FA\u5E03\u8BB0\u5F55\u672A\u7ED1\u5B9A\u551B\u67B6\u5BFC\u5165\u6765\u6E90\uFF0C\u4ECD\u53EF\u624B\u5DE5\u8865\u5F55\u5B9E\u9645\u5377\u4E0E\u4EBA\u5458\u6570\u636E\u3002</div>'
  );
}
function renderSpreadingPlanSection(session) {
  if (session.spreadingMode === "high_low" || session.spreadingMode === "fold_high_low") {
    return renderSection(
      "\u8BA1\u5212\u94FA\u5E03\u660E\u7EC6\u533A",
      session.highLowPlanSnapshot ? `
            <div class="space-y-4">
              <article class="space-y-3">
                <h4 class="text-sm font-semibold text-foreground">\u88C1\u526A\u660E\u7EC6\u77E9\u9635\u5FEB\u7167</h4>
                ${renderHighLowCuttingMatrix(session.highLowPlanSnapshot.cuttingRows, true)}
              </article>
              <article class="space-y-3">
                <h4 class="text-sm font-semibold text-foreground">\u6A21\u5F0F\u5206\u5E03\u77E9\u9635\u5FEB\u7167</h4>
                ${renderHighLowPatternMatrix(session.highLowPlanSnapshot.patternKeys, session.highLowPlanSnapshot.patternRows, true)}
              </article>
            </div>
          ` : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">\u5F53\u524D\u7F3A\u5C11\u9AD8\u4F4E\u5C42\u8BA1\u5212\u77E9\u9635\u5FEB\u7167\uFF0C\u8BF7\u5148\u56DE\u5230\u551B\u67B6\u8865\u9F50\u6A21\u677F\u6570\u636E\u3002</div>'
    );
  }
  return renderSection(
    "\u8BA1\u5212\u94FA\u5E03\u660E\u7EC6\u533A",
    session.planLineItems?.length ? `
          <div class="overflow-auto">
            <table class="w-full min-w-[1180px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">\u551B\u67B6\u7F16\u53F7</th>
                  <th class="px-3 py-3">\u551B\u67B6\u8BB0\u5F55</th>
                  <th class="px-3 py-3">\u989C\u8272</th>
                  <th class="px-3 py-3">\u8BA1\u5212\u5C42\u6570</th>
                  <th class="px-3 py-3">\u551B\u67B6\u51C0\u957F</th>
                  <th class="px-3 py-3">\u5355\u5C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                  <th class="px-3 py-3">\u5355\u4EF6\u6210\u8863\u7528\u91CF\uFF08m/\u4EF6\uFF09</th>
                  <th class="px-3 py-3">\u7406\u8BBA\u94FA\u5E03\u603B\u957F\u5EA6\uFF08m\uFF09</th>
                  <th class="px-3 py-3">\u95E8\u5E45\u63D0\u793A</th>
                  <th class="px-3 py-3">\u5907\u6CE8</th>
                </tr>
              </thead>
              <tbody>
                ${session.planLineItems.map(
      (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-3">${escapeHtml(item.layoutCode || "\u5F85\u8865")}</td>
                        <td class="px-3 py-3">${escapeHtml(item.layoutDetailText || "\u5F85\u8865")}</td>
                        <td class="px-3 py-3">${escapeHtml(item.color || "\u5F85\u8865")}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.spreadRepeatCount || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatLength(item.markerLength || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.markerPieceCount || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatLength(item.singlePieceUsage || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatLength(item.plannedSpreadTotalLength || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(item.widthHint || "\u2014")}</td>
                        <td class="px-3 py-3">${escapeHtml(item.note || "\u2014")}</td>
                      </tr>
                    `
    ).join("")}
              </tbody>
            </table>
          </div>
        ` : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">\u5F53\u524D\u7F3A\u5C11\u8BA1\u5212\u94FA\u5E03\u660E\u7EC6\uFF0C\u8BF7\u5148\u56DE\u5230\u551B\u67B6\u8865\u9F50\u53EF\u5BFC\u5165\u7684\u551B\u67B6\u660E\u7EC6\u3002</div>'
  );
}
function renderMarkerPlanMetricsSection(marker, usageSummary) {
  return renderSection(
    "\u8BA1\u5212 / \u8BA1\u7B97\u8865\u5145\u4FE1\u606F\u533A",
    `
      <div class="mb-3 rounded-lg border bg-muted/10 px-3 py-3">
        <div class="text-xs text-muted-foreground">\u9762\u6599</div>
        <div class="mt-2">${renderMaterialIdentityBlock({
      materialSku: marker.fabricSku || marker.materialSkuSummary || "\u5F85\u8865",
      materialLabel: marker.materialSkuSummary || marker.fabricSku || "\u5F85\u8865",
      materialCategory: marker.materialCategory || "",
      materialAlias: marker.materialAliasSummary || "",
      materialImageUrl: marker.materialImageUrl || ""
    })}</div>
      </div>
      ${renderInfoGrid([
      { label: "\u9762\u6599\u7C7B\u522B", value: marker.materialCategory || "\u5F85\u8865" },
      { label: "\u9762\u6599\u5C5E\u6027", value: marker.materialAttr || "\u5F85\u8865" },
      { label: "\u8BA1\u5212\u5C3A\u7801\u914D\u6BD4\u6587\u672C", value: marker.sizeRatioPlanText || "\u5F85\u8865" },
      { label: "\u8BA1\u5212\u94FA\u5E03\u5C42\u6570\uFF08\u5C42\uFF09", value: `${formatQty(marker.plannedLayerCount || 0)} \u5C42` },
      { label: "\u5C42\u6570\u6765\u6E90\u503C\uFF08\u5C42\uFF09", value: `${formatQty(marker.plannedMarkerCount || marker.plannedLayerCount || 0)} \u5C42` },
      { label: "\u551B\u67B6\u51C0\u957F\uFF08m\uFF09", value: formatLength(marker.markerLength || marker.netLength) },
      { label: "\u91C7\u8D2D\u5355\u4EF6\u6210\u8863\u7528\u91CF\uFF08m/\u4EF6\uFF09", value: formatLength(usageSummary.procurementUnitUsage) },
      { label: "\u5B9E\u9645\u5355\u4EF6\u6210\u8863\u7528\u91CF\uFF08m/\u4EF6\uFF09", value: formatLength(usageSummary.actualUnitUsage) },
      { label: "\u9884\u7B97\u957F\u5EA6\uFF08m\uFF09", value: formatLength(usageSummary.plannedMaterialMeter) },
      { label: "\u5B9E\u9645\u4F7F\u7528\u957F\u5EA6\uFF08m\uFF09", value: formatLength(usageSummary.actualMaterialMeter) },
      { label: "\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", value: `${formatQty(usageSummary.actualCutQty)} \u4EF6` }
    ])}
    `
  );
}
function renderMarkerRowTemplateDetailTable(lineItems) {
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-[1180px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u884C\u53F7</th>
            <th class="px-3 py-3">\u551B\u67B6\u7F16\u53F7</th>
            <th class="px-3 py-3">\u551B\u67B6\u660E\u7EC6</th>
            <th class="px-3 py-3">\u989C\u8272</th>
            <th class="px-3 py-3">\u8BA1\u5212\u5C42\u6570</th>
            <th class="px-3 py-3">\u551B\u67B6\u51C0\u957F</th>
            <th class="px-3 py-3">\u5355\u5C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
            <th class="px-3 py-3">\u5355\u4EF6\u6210\u8863\u7528\u91CF\uFF08m/\u4EF6\uFF09</th>
            <th class="px-3 py-3">\u8BA1\u5212\u94FA\u5E03\u603B\u957F\u5EA6\uFF08m\uFF09</th>
            <th class="px-3 py-3">\u95E8\u5E45\u63D0\u793A</th>
            <th class="px-3 py-3">\u5907\u6CE8</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(
    (item) => `
                <tr class="border-b">
                  <td class="px-3 py-3">${escapeHtml(String(item.lineNo || "-"))}</td>
                  <td class="px-3 py-3">${escapeHtml(item.layoutCode || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(item.layoutDetailText || item.ratioLabel || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(item.color || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(item.spreadRepeatCount || 0))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatLength(item.markerLength))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(item.markerPieceCount ?? item.pieceCount ?? 0))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatLength(item.singlePieceUsage || computeSinglePieceUsage(item.markerLength, item.markerPieceCount ?? item.pieceCount ?? 0)))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatLength(item.spreadTotalLength ?? item.spreadingTotalLength ?? Number((item.markerLength * Math.max(item.spreadRepeatCount || 0, 0)).toFixed(2))))}</td>
                  <td class="px-3 py-3">${escapeHtml(item.widthHint || "\u2014")}</td>
                  <td class="px-3 py-3">${escapeHtml(item.note || "\u2014")}</td>
                </tr>
              `
  ).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function renderHighLowCuttingMatrix(rows, readonly = true) {
  const columnTotals = Object.fromEntries(
    MARKER_SIZE_KEYS.map((sizeKey) => [sizeKey, rows.reduce((sum, row) => sum + Math.max(row.sizeValues[sizeKey] || 0, 0), 0)])
  );
  const grandTotal = MARKER_SIZE_KEYS.reduce((sum, sizeKey) => sum + columnTotals[sizeKey], 0);
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-[980px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u989C\u8272</th>
            ${MARKER_SIZE_KEYS.map((sizeKey) => `<th class="px-3 py-3">${escapeHtml(sizeKey)}</th>`).join("")}
            <th class="px-3 py-3">\u5408\u8BA1</th>
            ${readonly ? "" : '<th class="px-3 py-3">\u64CD\u4F5C</th>'}
          </tr>
        </thead>
        <tbody>
          ${rows.map(
    (row, rowIndex) => `
                <tr class="border-b">
                  <td class="px-3 py-3">
                    ${readonly ? escapeHtml(row.color || "\u5F85\u8865") : `<input type="text" value="${escapeHtml(row.color || "")}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-highlow-cutting-row-index="${rowIndex}" data-cutting-marker-highlow-cutting-color="true" />`}
                  </td>
                  ${MARKER_SIZE_KEYS.map(
      (sizeKey) => readonly ? `<td class="px-3 py-3">${escapeHtml(formatQty(row.sizeValues[sizeKey] || 0))}</td>` : `<td class="px-3 py-3"><input type="number" value="${escapeHtml(String(row.sizeValues[sizeKey] || 0))}" class="h-9 w-20 rounded-md border px-3 text-sm" data-cutting-marker-highlow-cutting-row-index="${rowIndex}" data-cutting-marker-highlow-cutting-size="${escapeHtml(sizeKey)}" /></td>`
    ).join("")}
                  <td class="px-3 py-3 font-medium">${escapeHtml(formatQty(row.total || 0))}</td>
                  ${readonly ? "" : `<td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-highlow-cutting-row" data-index="${rowIndex}">\u5220\u9664</button></td>`}
                </tr>
              `
  ).join("")}
        </tbody>
        <tfoot class="bg-muted/30 text-xs font-medium text-foreground">
          <tr>
            <td class="px-3 py-3">\u5217\u5408\u8BA1</td>
            ${MARKER_SIZE_KEYS.map((sizeKey) => `<td class="px-3 py-3">${escapeHtml(formatQty(columnTotals[sizeKey]))}</td>`).join("")}
            <td class="px-3 py-3">${escapeHtml(formatQty(grandTotal))}</td>
            ${readonly ? "" : '<td class="px-3 py-3">\u2014</td>'}
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
function renderHighLowPatternMatrix(patternKeys, rows, readonly = true) {
  const columnTotals = Object.fromEntries(
    patternKeys.map((patternKey) => [patternKey, rows.reduce((sum, row) => sum + Math.max(row.patternValues[patternKey] || 0, 0), 0)])
  );
  const grandTotal = patternKeys.reduce((sum, patternKey) => sum + Number(columnTotals[patternKey] || 0), 0);
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-[980px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u989C\u8272</th>
            ${patternKeys.map(
    (patternKey, patternIndex) => readonly ? `<th class="px-3 py-3">${escapeHtml(patternKey)}</th>` : `<th class="px-3 py-3">
                      <div class="space-y-1">
                        <input type="text" value="${escapeHtml(patternKey)}" class="h-8 w-28 rounded-md border px-2 text-xs" data-cutting-marker-highlow-pattern-key-index="${patternIndex}" />
                        <button type="button" class="rounded-md border px-2 py-0.5 text-[11px] hover:bg-muted" data-cutting-marker-action="remove-highlow-pattern-key" data-index="${patternIndex}">\u5220\u5217</button>
                      </div>
                    </th>`
  ).join("")}
            <th class="px-3 py-3">\u5408\u8BA1</th>
            ${readonly ? "" : '<th class="px-3 py-3">\u64CD\u4F5C</th>'}
          </tr>
        </thead>
        <tbody>
          ${rows.map(
    (row, rowIndex) => `
                <tr class="border-b">
                  <td class="px-3 py-3">
                    ${readonly ? escapeHtml(row.color || "\u5F85\u8865") : `<input type="text" value="${escapeHtml(row.color || "")}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-highlow-pattern-row-index="${rowIndex}" data-cutting-marker-highlow-pattern-color="true" />`}
                  </td>
                  ${patternKeys.map(
      (patternKey) => readonly ? `<td class="px-3 py-3">${escapeHtml(formatQty(row.patternValues[patternKey] || 0))}</td>` : `<td class="px-3 py-3"><input type="number" value="${escapeHtml(String(row.patternValues[patternKey] || 0))}" class="h-9 w-20 rounded-md border px-3 text-sm" data-cutting-marker-highlow-pattern-row-index="${rowIndex}" data-cutting-marker-highlow-pattern-key="${escapeHtml(patternKey)}" /></td>`
    ).join("")}
                  <td class="px-3 py-3 font-medium">${escapeHtml(formatQty(row.total || 0))}</td>
                  ${readonly ? "" : `<td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-highlow-pattern-row" data-index="${rowIndex}">\u5220\u9664</button></td>`}
                </tr>
              `
  ).join("")}
        </tbody>
        <tfoot class="bg-muted/30 text-xs font-medium text-foreground">
          <tr>
            <td class="px-3 py-3">\u5217\u5408\u8BA1</td>
            ${patternKeys.map((patternKey) => `<td class="px-3 py-3">${escapeHtml(formatQty(Number(columnTotals[patternKey] || 0)))}</td>`).join("")}
            <td class="px-3 py-3">${escapeHtml(formatQty(grandTotal))}</td>
            ${readonly ? "" : '<td class="px-3 py-3">\u2014</td>'}
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
function renderMarkerDetailPage() {
  return renderListPage();
  const pathname = getCurrentPathname();
  const meta = getCanonicalCuttingMeta(pathname, "marker-detail");
  const row = getMarkerRow(getSearchParams().get("markerId"));
  if (!row) {
    return `
      <div class="space-y-3 p-4">
        ${renderCuttingPageHeader(meta, {
      actionsHtml: renderHeaderActions(appendSummaryReturnAction([
        '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="markers">\u8FD4\u56DE\u5217\u8868</button>'
      ]))
    })}
        <section class="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">\u672A\u627E\u5230\u5BF9\u5E94\u8BA1\u5212\u8BB0\u5F55\uFF0C\u8BF7\u8FD4\u56DE\u5217\u8868\u91CD\u65B0\u9009\u62E9\u3002</section>
      </div>
    `;
  }
  const detailView = buildMarkerDetailViewModel(row);
  const modeMeta = deriveMarkerModeMeta(row.record.markerMode);
  const usageSummary = detailView.usageSummary;
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: renderHeaderActions(appendSummaryReturnAction([
      '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="markers">\u8FD4\u56DE\u5217\u8868</button>',
      `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-detail" data-marker-id="${escapeHtml(row.markerId)}">\u67E5\u770B\u5173\u8054\u551B\u67B6\u7F16\u53F7</button>`
    ]))
  })}
      ${renderPrefilterBar()}
      ${renderSection(
    "\u57FA\u7840\u4FE1\u606F\u533A",
    `
          <div class="mb-3 rounded-lg border bg-muted/10 px-3 py-3">
            <div class="text-xs text-muted-foreground">\u9762\u6599</div>
            <div class="mt-2">${renderMaterialIdentityBlock({
      materialSku: row.materialSkuSummary || "\u5F85\u8865",
      materialLabel: row.materialSkuSummary || "\u5F85\u8865",
      materialAlias: row.record.materialAliasSummary || "",
      materialImageUrl: row.record.materialImageUrl || ""
    })}</div>
          </div>
            ${renderInfoGrid([
      { label: "\u65B9\u6848\u7F16\u53F7", value: row.markerNo },
      { label: "\u6A21\u5F0F", value: modeMeta.label },
      { label: "\u88C1\u7247\u5355\u6458\u8981", value: row.cutOrderNos.join(" / ") || "\u5F85\u8865" },
      { label: "\u5173\u8054\u551B\u67B6\u65B9\u6848", value: row.markerPlanNo || "\u672A\u5173\u8054\u551B\u67B6\u65B9\u6848" },
      { label: "\u6B3E\u53F7 / SPU", value: `${row.styleCode || "\u5F85\u8865"} / ${row.spuCode || "\u5F85\u8865"}` },
      { label: "\u989C\u8272\u6458\u8981", value: row.colorSummary || "\u5F85\u8865" }
    ])}
        `
  )}
      ${renderSection("\u5173\u8054\u88C1\u7247\u5355\u533A", renderMarkerSourceRowsTable(detailView.sourceOrderRows))}
      ${renderSection("\u551B\u67B6\u5206\u914D\u660E\u7EC6\u533A", renderMarkerAllocationTable(detailView.allocationRows))}
      ${renderSection(
    "\u88C1\u7247\u62C6\u89E3\u9884\u89C8\u533A",
    `
          <div class="space-y-4">
            <article class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                ${renderTag(`\u5173\u8054\u88C1\u7247\u5355 ${detailView.totals.sourceOrderCount}`, "bg-slate-100 text-slate-700")}
                ${renderTag(`\u5206\u914D\u884C ${detailView.totals.allocationLineCount}`, "bg-slate-100 text-slate-700")}
                ${renderTag(`SKU \u884C ${detailView.totals.skuRowCount}`, "bg-slate-100 text-slate-700")}
                ${renderTag(`\u90E8\u4F4D\u884C ${detailView.totals.pieceRowCount}`, "bg-slate-100 text-slate-700")}
                ${renderTag(`\u62C6\u89E3\u603B\u88C1\u7247\u6570 ${formatQty(detailView.totals.explodedPieceQtyTotal)}`, "bg-blue-100 text-blue-700")}
              </div>
              <h4 class="text-sm font-semibold text-foreground">\u6309 SKU \u6C47\u603B</h4>
              ${renderMarkerSkuSummaryTable(detailView.skuSummaryRows)}
            </article>
            <article class="space-y-3">
              <h4 class="text-sm font-semibold text-foreground">\u6309\u90E8\u4F4D\u660E\u7EC6</h4>
              ${renderMarkerPieceDetailTable(detailView.pieceDetailRows)}
            </article>
          </div>
        `
  )}
      ${renderSection(
    "\u6620\u5C04\u5F02\u5E38\u533A",
    detailView.mappingWarnings.length ? `
            <div class="space-y-3">
              <div class="flex flex-wrap gap-2">
                ${detailView.mappingWarnings.map((warning) => renderTag(warning, "bg-amber-100 text-amber-700")).join("")}
              </div>
              <div class="overflow-auto">
                <table class="w-full min-w-full text-sm">
                  <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-3">\u6765\u6E90\u88C1\u7247\u5355\u53F7</th>
                      <th class="px-3 py-3">\u989C\u8272</th>
                      <th class="px-3 py-3">\u5C3A\u7801</th>
                      <th class="px-3 py-3">\u9762\u6599</th>
                      <th class="px-3 py-3">\u5F02\u5E38</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detailView.missingMappings.map(
      (item) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(item.sourceCutOrderNo)}</td>
                            <td class="px-3 py-3">${escapeHtml(item.color || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${escapeHtml(item.sizeLabel || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
        materialSku: item.materialSku || "\u5F85\u8865",
        materialLabel: item.materialSku || "\u5F85\u8865",
        materialAlias: item.materialAlias,
        materialImageUrl: item.materialImageUrl
      }, { compact: true })}</td>
                            <td class="px-3 py-3">${getMarkerMappingStatusTag(item.mappingStatus)}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.reason)}</div></td>
                          </tr>
                        `
    ).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          ` : '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">\u5F53\u524D\u672A\u53D1\u73B0\u6280\u672F\u5305\u6620\u5C04\u5F02\u5E38\u3002</div>'
  )}
      ${renderSection(
    "\u5C3A\u7801\u914D\u6BD4\u533A",
    `
          ${renderInfoGrid([
      { label: "\u551B\u67B6\u8BA1\u5212\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", value: `${formatQty(row.totalPieces)} \u4EF6` },
      { label: "\u8BA1\u5212\u5C3A\u7801\u914D\u6BD4", value: detailView.sizeRatioPlanText || "\u5F85\u8865" },
      { label: "\u914D\u6BD4\u6458\u8981", value: detailView.lineSummary.summaryText }
    ])}
          <div class="mt-4 overflow-auto">
            <table class="w-full min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">\u5C3A\u7801</th>
                  <th class="px-3 py-3">\u5C3A\u7801\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                </tr>
              </thead>
              <tbody>
                ${row.record.sizeDistribution.map(
      (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-3">${escapeHtml(item.sizeLabel)}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.quantity))}</td>
                      </tr>
                    `
    ).join("")}
              </tbody>
            </table>
          </div>
        `
  )}
      ${detailView.templateType === "row-template" ? renderSection(
    "\u551B\u67B6\u660E\u7EC6\u533A",
    renderMarkerRowTemplateDetailTable(row.record.lineItems || [])
  ) : renderSection(
    "\u9AD8\u4F4E\u5C42\u77E9\u9635\u533A",
    `
                <div class="space-y-4">
                  <article class="space-y-3">
                    <div>
                      <h4 class="text-sm font-semibold text-foreground">\u88C1\u526A\u660E\u7EC6\u77E9\u9635</h4>
                    </div>
                    ${renderHighLowCuttingMatrix(detailView.highLowCuttingRows, true)}
                    <p class="text-xs text-muted-foreground">\u88C1\u526A\u660E\u7EC6\u603B\u5408\u8BA1\uFF1A${escapeHtml(formatQty(detailView.highLowCuttingTotal))} \u4EF6</p>
                  </article>
                  <article class="space-y-3">
                    <div>
                      <h4 class="text-sm font-semibold text-foreground">\u551B\u67B6\u6A21\u5F0F\u77E9\u9635</h4>
                    </div>
                    ${renderHighLowPatternMatrix(detailView.highLowPatternKeys, detailView.highLowPatternRows, true)}
                    <p class="text-xs text-muted-foreground">\u6A21\u5F0F\u77E9\u9635\u603B\u5408\u8BA1\uFF1A${escapeHtml(formatQty(detailView.highLowPatternTotal))} \u4EF6</p>
                  </article>
                </div>
              `
  )}
      ${renderSection(
    "\u957F\u5EA6\u4E0E\u7528\u91CF\u533A",
    renderInfoGrid([
      { label: "\u551B\u67B6\u51C0\u957F\u5EA6", value: formatLength(row.netLength) },
      { label: "\u5355\u4EF6\u6210\u8863\u7528\u91CF\uFF08m/\u4EF6\uFF09", value: formatLength(row.singlePieceUsage) },
      { label: "\u8BA1\u5212\u94FA\u5E03\u603B\u957F\u5EA6\uFF08m\uFF09", value: formatLength(row.spreadTotalLength) },
      { label: "\u9884\u7B97\u7C73\u6570", value: formatLength(usageSummary.plannedMaterialMeter) },
      { label: "\u5B9E\u9645\u4F7F\u7528\u7C73\u6570", value: formatLength(usageSummary.actualMaterialMeter) },
      { label: "\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", value: `${formatQty(usageSummary.actualCutQty)} \u4EF6` }
    ])
  )}
      ${renderMarkerPlanMetricsSection(row.record, usageSummary)}
      ${renderMarkerWarningSection(detailView.warningMessages)}
      ${renderSection(
    "\u56FE\u7247\u4E0E\u5907\u6CE8\u533A",
    `
          <div class="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">\u551B\u67B6\u660E\u7EC6\u56FE</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(row.record.markerImageName || "\u5F53\u524D\u672A\u4E0A\u4F20\u551B\u67B6\u660E\u7EC6\u56FE")}</p>
            </article>
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">\u5907\u6CE8\u4E0E\u8C03\u6574</p>
              <p class="mt-1 text-sm">${escapeHtml(row.record.note || "\u6682\u65E0\u5907\u6CE8")}</p>
            <div class="mt-3 rounded-md border bg-background px-3 py-3 text-sm">
              <p>\u662F\u5426\u6709\u8C03\u6574\uFF1A${escapeHtml(row.record.adjustmentRequired ? "\u662F" : "\u5426")}</p>
              <p class="mt-1">\u8C03\u6574\u8BB0\u5F55\uFF1A${escapeHtml(row.record.adjustmentNote || "\u6682\u65E0")}</p>
              </div>
            </article>
          </div>
        `
  )}
    </div>
  `;
}
function renderMarkerEditPage() {
  return renderListPage();
  const pathname = getCurrentPathname();
  const meta = getCanonicalCuttingMeta(pathname, "marker-edit");
  const draft2 = ensureMarkerDraftShape(state.markerDraft || buildNewMarkerDraft());
  const totalPieces = computeMarkerTotalPieces(draft2.sizeDistribution);
  const templateType = deriveMarkerTemplateByMode(draft2.markerMode);
  const usageSummary = computeUsageSummary({
    ...draft2,
    totalPieces,
    spreadTotalLength: templateType === "row-template" ? computeNormalMarkerSpreadTotalLength(draft2.lineItems || []) : Number(draft2.spreadTotalLength || draft2.actualMaterialMeter || 0)
  });
  const warningMessages = buildMarkerWarningMessages({
    ...draft2,
    totalPieces,
    spreadTotalLength: templateType === "row-template" ? computeNormalMarkerSpreadTotalLength(draft2.lineItems || []) : Number(draft2.spreadTotalLength || draft2.actualMaterialMeter || 0)
  });
  const patternKeys = draft2.highLowPatternKeys?.length ? draft2.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS];
  const highLowCuttingTotals = computeHighLowCuttingTotals(draft2.highLowCuttingRows || []);
  const highLowPatternTotals = computeHighLowPatternTotals(draft2.highLowPatternRows || [], patternKeys);
  const sourceRows = getMarkerDraftSourceRows(draft2);
  const pieceExplosion = buildMarkerDraftPieceExplosion(draft2);
  const allocationWarningMessages = Array.from(/* @__PURE__ */ new Set([...warningMessages, ...pieceExplosion.mappingWarnings]));
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: renderHeaderActions(appendSummaryReturnAction([
      '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="cancel-spreading-edit">\u53D6\u6D88</button>',
      '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="save-spreading">\u4FDD\u5B58\u8349\u7A3F</button>',
      '<button type="button" class="rounded-md bg-blue-600 px-3 py-3 text-sm text-white hover:bg-blue-700" data-cutting-marker-action="save-spreading-and-view">\u4FDD\u5B58\u5E76\u8FD4\u56DE\u8BE6\u60C5</button>'
    ]))
  })}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderSection(
    "\u57FA\u7840\u8868\u5355",
    `
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderTextInput("\u65B9\u6848\u7F16\u53F7", draft2.markerNo || "", 'data-cutting-marker-draft-field="markerNo"')}
            ${renderSelect("\u551B\u67B6\u6A21\u5F0F", draft2.markerMode, 'data-cutting-marker-draft-field="markerMode"', [
      { value: "normal", label: "\u666E\u901A\u551B\u67B6" },
      { value: "high_low", label: "\u9AD8\u4F4E\u5C42\u551B\u67B6" },
      { value: "fold_normal", label: "\u5BF9\u6298\u666E\u901A\u551B\u67B6" },
      { value: "fold_high_low", label: "\u5BF9\u6298\u9AD8\u4F4E\u5C42\u551B\u67B6" }
    ])}
            ${renderTextInput("\u5173\u8054\u88C1\u7247\u5355", (draft2.cutOrderNos || draft2.cutOrderIds).join(" / "), "disabled", "\u5F53\u524D\u7531\u4E0A\u6E38\u9884\u7B5B\u5E26\u5165")}
            ${renderTextInput("\u5173\u8054\u551B\u67B6\u65B9\u6848", draft2.markerPlanNo || "", "disabled", "\u53EF\u4E3A\u7A7A")}
            ${renderTextInput("\u6B3E\u53F7 / SPU", `${draft2.styleCode || ""} / ${draft2.spuCode || ""}`, "disabled", "\u6765\u6E90\u4E8E\u4E0A\u4E0B\u6587")}
            ${renderTextInput("\u9762\u6599\u6458\u8981", draft2.materialSkuSummary || "", "disabled")}
            ${renderTextInput("\u989C\u8272\u6458\u8981", draft2.colorSummary || "", 'data-cutting-marker-draft-field="colorSummary"', "\u53EF\u624B\u5DE5\u8865\u5145")}
            ${renderNumberInput("\u551B\u67B6\u51C0\u957F\u5EA6\uFF08\u7C73\uFF09", draft2.netLength, 'data-cutting-marker-draft-field="netLength"')}
            ${renderNumberInput("\u5355\u4EF6\u6210\u8863\u7528\u91CF\uFF08m/\u4EF6\uFF09", draft2.singlePieceUsage, 'data-cutting-marker-draft-field="singlePieceUsage"', "0.001")}
            ${renderNumberInput("\u8BA1\u5212\u94FA\u5E03\u603B\u957F\u5EA6\uFF08m\uFF09", draft2.spreadTotalLength || 0, 'data-cutting-marker-draft-field="spreadTotalLength"', "0.01")}
          </div>
        `
  )}
      ${renderSection("\u5173\u8054\u88C1\u7247\u5355\u4E0E\u53EF\u5206\u914D\u80CC\u666F\u533A", renderMarkerSourceRowsTable(pieceExplosion.sourceOrderRows))}
      ${renderSection(
    "\u5206\u914D\u660E\u7EC6\u7F16\u8F91\u533A",
    `
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm text-muted-foreground">\u6309\u6765\u6E90\u88C1\u7247\u5355 + \u989C\u8272 + \u5C3A\u7801\u5206\u914D\u8BA1\u5212\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09\uFF0C\u4F5C\u4E3A\u6280\u672F\u5305\u88C1\u7247\u62C6\u89E3\u7684\u4E8B\u5B9E\u6E90\u3002</div>
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-allocation-line">\u65B0\u589E\u5206\u914D\u884C</button>
          </div>
          <div class="overflow-auto">
            <table class="w-full min-w-[1380px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">\u6765\u6E90\u88C1\u7247\u5355</th>
                  <th class="px-3 py-3">\u6765\u6E90\u751F\u4EA7\u5355</th>
                  <th class="px-3 py-3">\u989C\u8272</th>
                  <th class="px-3 py-3">\u9762\u6599</th>
                  <th class="px-3 py-3">\u6B3E\u53F7 / SPU</th>
                  <th class="px-3 py-3">\u6280\u672F\u5305 SPU</th>
                  <th class="px-3 py-3">\u5C3A\u7801</th>
                  <th class="px-3 py-3">\u8BA1\u5212\u6210\u8863\u6570</th>
                  <th class="px-3 py-3">\u5907\u6CE8</th>
                  <th class="px-3 py-3">\u64CD\u4F5C</th>
                </tr>
              </thead>
              <tbody>
                ${(draft2.allocationLines || []).map((line, index) => {
      const selectedSourceRow = sourceRows.find((row) => row.sourceCutOrderId === line.sourceCutOrderId) || null;
      return `
                      <tr class="border-b align-top">
                        <td class="px-3 py-3">
                          <select class="h-9 min-w-[12rem] rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="sourceCutOrderId">
                            <option value="">\u8BF7\u9009\u62E9\u6765\u6E90\u88C1\u7247\u5355</option>
                            ${sourceRows.map(
        (row) => `<option value="${escapeHtml(row.sourceCutOrderId)}" ${row.sourceCutOrderId === line.sourceCutOrderId ? "selected" : ""}>${escapeHtml(row.sourceCutOrderNo)}</option>`
      ).join("")}
                          </select>
                        </td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(selectedSourceRow?.sourceProductionOrderNo || line.sourceProductionOrderNo || "\u5F85\u8865")}</td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(selectedSourceRow?.color || line.color || "\u5F85\u8865")}</td>
                        <td class="px-3 py-3 text-muted-foreground">${renderMaterialIdentityBlock({
        materialSku: selectedSourceRow?.materialSku || line.materialSku || "\u5F85\u8865",
        materialLabel: selectedSourceRow?.materialSku || line.materialSku || "\u5F85\u8865",
        materialAlias: selectedSourceRow?.materialAlias || "",
        materialImageUrl: selectedSourceRow?.materialImageUrl || ""
      }, { compact: true })}</td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(`${selectedSourceRow?.styleCode || line.styleCode || "\u5F85\u8865"} / ${selectedSourceRow?.spuCode || line.spuCode || "\u5F85\u8865"}`)}</td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(selectedSourceRow?.techPackSpuCode || line.techPackSpuCode || "\u672A\u5173\u8054")}</td>
                        <td class="px-3 py-3">
                          <input type="text" value="${escapeHtml(line.sizeLabel || "")}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="sizeLabel" />
                        </td>
                        <td class="px-3 py-3">
                          <input type="number" min="0" value="${escapeHtml(String(line.plannedGarmentQty || 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="plannedGarmentQty" />
                        </td>
                        <td class="px-3 py-3">
                          <input type="text" value="${escapeHtml(line.note || "")}" class="h-9 w-40 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="note" />
                        </td>
                        <td class="px-3 py-3">
                          <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-allocation-line" data-index="${index}">\u5220\u9664</button>
                        </td>
                      </tr>
                    `;
    }).join("")}
              </tbody>
            </table>
          </div>
        `
  )}
      ${renderSection(
    "\u5B9E\u65F6\u6821\u9A8C\u533A",
    `
          <div class="overflow-auto">
            <table class="w-full min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">\u5C3A\u7801</th>
                  <th class="px-3 py-3">\u5C3A\u7801\u914D\u6BD4</th>
                  <th class="px-3 py-3">allocation \u5408\u8BA1</th>
                  <th class="px-3 py-3">\u5DEE\u503C</th>
                  <th class="px-3 py-3">\u6821\u9A8C</th>
                </tr>
              </thead>
              <tbody>
                ${pieceExplosion.allocationSizeSummary.map(
      (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-3">${escapeHtml(item.sizeLabel)}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.requiredQty))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.allocatedQty))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(Math.abs(item.differenceQty)))}</td>
                        <td class="px-3 py-3">${item.differenceQty === 0 ? renderTag("\u5DF2\u914D\u5E73", "bg-emerald-100 text-emerald-700") : renderTag(formatSizeBalance(item.requiredQty, item.allocatedQty), "bg-amber-100 text-amber-700")}</td>
                      </tr>
                    `
    ).join("")}
              </tbody>
            </table>
          </div>
        `
  )}
      ${renderSection(
    "\u5C3A\u7801\u914D\u6BD4\u7F16\u8F91\u533A",
    `
          <div class="mb-3 flex items-center justify-between">
            <div>
              <p class="mt-1 text-xs text-muted-foreground">\u5F53\u524D\u603B\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09\uFF1A${escapeHtml(formatQty(totalPieces))} \u4EF6</p>
            </div>
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-size-row">\u65B0\u589E\u5C3A\u7801\u884C</button>
          </div>
          <div class="overflow-auto">
            <table class="w-full min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">\u5C3A\u7801</th>
                  <th class="px-3 py-3">\u5C3A\u7801\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                  <th class="px-3 py-3">\u64CD\u4F5C</th>
                </tr>
              </thead>
              <tbody>
                ${draft2.sizeDistribution.map(
      (item, index) => `
                      <tr class="border-b">
                        <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.sizeLabel)}" class="h-9 w-full rounded-md border px-3 text-sm" data-cutting-marker-size-index="${index}" data-cutting-marker-size-field="sizeLabel" /></td>
                        <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.quantity))}" class="h-9 w-full rounded-md border px-3 text-sm" data-cutting-marker-size-index="${index}" data-cutting-marker-size-field="quantity" /></td>
                        <td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-size-row" data-index="${index}">\u5220\u9664</button></td>
                      </tr>
                    `
    ).join("")}
              </tbody>
            </table>
          </div>
        `
  )}
      ${renderSection(
    "\u88C1\u7247\u62C6\u89E3\u5B9E\u65F6\u9884\u89C8\u533A",
    `
          <div class="space-y-4">
            <article class="space-y-3">
              <h4 class="text-sm font-semibold text-foreground">\u6309 SKU \u6C47\u603B</h4>
              ${renderMarkerSkuSummaryTable(pieceExplosion.skuSummaryRows)}
            </article>
            <article class="space-y-3">
              <h4 class="text-sm font-semibold text-foreground">\u6309\u90E8\u4F4D\u660E\u7EC6</h4>
              ${renderMarkerPieceDetailTable(pieceExplosion.pieceDetailRows)}
            </article>
          </div>
        `
  )}
      ${templateType === "row-template" ? renderSection(
    "\u551B\u67B6\u660E\u7EC6\u7F16\u8F91\u533A",
    `
                <div class="mb-3 flex items-center justify-between">
                  <div>
                    <p class="text-sm text-muted-foreground">\u5F53\u524D\u6A21\u5F0F\u4F7F\u7528\u884C\u660E\u7EC6\u6A21\u677F\u3002\u660E\u7EC6\u884C\u4E0D\u518D\u5355\u72EC\u7EF4\u62A4\u6A21\u5F0F\uFF0C\u53EA\u627F\u63A5\u5F53\u524D\u551B\u67B6\u7F16\u53F7\u5934\u90E8\u6A21\u5F0F\u4E0B\u7684\u551B\u67B6\u6570\u636E\u3002</p>
                    <p class="mt-1 text-xs text-muted-foreground">\u5F53\u524D\u6A21\u5F0F\uFF1A${escapeHtml(deriveMarkerModeMeta(draft2.markerMode).label)}</p>
                  </div>
                  <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-line-item">\u65B0\u589E\u660E\u7EC6\u884C</button>
                </div>
                <div class="overflow-auto">
                  <table class="w-full min-w-[1380px] text-sm">
                    <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th class="px-3 py-3">\u884C\u53F7</th>
                        <th class="px-3 py-3">\u551B\u67B6\u7F16\u53F7</th>
                        <th class="px-3 py-3">\u551B\u67B6\u660E\u7EC6</th>
                        <th class="px-3 py-3">\u989C\u8272</th>
                        <th class="px-3 py-3">\u8BA1\u5212\u5C42\u6570</th>
                        <th class="px-3 py-3">\u551B\u67B6\u51C0\u957F</th>
                        <th class="px-3 py-3">\u5355\u5C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                        <th class="px-3 py-3">\u5355\u4EF6\u6210\u8863\u7528\u91CF\uFF08m/\u4EF6\uFF09</th>
                        <th class="px-3 py-3">\u8BA1\u5212\u94FA\u5E03\u603B\u957F\u5EA6\uFF08m\uFF09</th>
                        <th class="px-3 py-3">\u95E8\u5E45\u63D0\u793A</th>
                        <th class="px-3 py-3">\u5907\u6CE8</th>
                        <th class="px-3 py-3">\u64CD\u4F5C</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(draft2.lineItems || []).map(
      (item, index) => `
                            <tr class="border-b align-top">
                              <td class="px-3 py-3">${escapeHtml(String(item.lineNo || index + 1))}</td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.layoutCode || "")}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="layoutCode" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.layoutDetailText || item.ratioLabel || "")}" class="h-9 w-52 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="layoutDetailText" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.color)}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="color" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.spreadRepeatCount || 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="spreadRepeatCount" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.markerLength))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="markerLength" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.markerPieceCount ?? item.pieceCount ?? 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="markerPieceCount" /></td>
                              <td class="px-3 py-3"><input type="number" step="0.001" value="${escapeHtml(String(item.singlePieceUsage))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="singlePieceUsage" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.spreadTotalLength ?? item.spreadingTotalLength ?? 0))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="spreadTotalLength" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.widthHint || "")}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="widthHint" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.note)}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="note" /></td>
                              <td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-line-item" data-index="${index}">\u5220\u9664</button></td>
                            </tr>
                          `
    ).join("")}
                    </tbody>
                  </table>
                </div>
              `
  ) : renderSection(
    "\u9AD8\u4F4E\u5C42\u77E9\u9635\u7F16\u8F91\u533A",
    `
                <div class="space-y-5">
                  <article class="space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-foreground">\u88C1\u526A\u660E\u7EC6\u77E9\u9635</h4>
                      </div>
                      <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-cutting-row">\u65B0\u589E\u989C\u8272\u884C</button>
                    </div>
                    ${renderHighLowCuttingMatrix(highLowCuttingTotals.rows, false)}
                    <p class="text-xs text-muted-foreground">\u88C1\u526A\u660E\u7EC6\u603B\u5408\u8BA1\uFF1A${escapeHtml(formatQty(highLowCuttingTotals.cuttingTotal))} \u4EF6</p>
                  </article>
                  <article class="space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-foreground">\u551B\u67B6\u6A21\u5F0F\u77E9\u9635</h4>
                      </div>
                      <div class="flex gap-2">
                        <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-pattern-key">\u65B0\u589E\u6A21\u5F0F\u5217</button>
                        <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-pattern-row">\u65B0\u589E\u989C\u8272\u884C</button>
                      </div>
                    </div>
                    ${renderHighLowPatternMatrix(patternKeys, highLowPatternTotals.rows, false)}
                    <p class="text-xs text-muted-foreground">\u6A21\u5F0F\u77E9\u9635\u603B\u5408\u8BA1\uFF1A${escapeHtml(formatQty(highLowPatternTotals.patternTotal))} \u4EF6</p>
                  </article>
                </div>
              `
  )}
      ${renderMarkerPlanMetricsSection(draft2, usageSummary)}
      ${renderMarkerWarningSection(allocationWarningMessages)}
      ${renderSection(
    "\u56FE\u7247\u4FE1\u606F\u533A",
    `
          <div class="grid gap-3 md:grid-cols-2">
            ${renderTextInput("\u551B\u67B6\u660E\u7EC6\u56FE\u6587\u4EF6\u540D", draft2.markerImageName || "", 'data-cutting-marker-draft-field="markerImageName"')}
            ${renderTextInput("\u56FE\u7247\u9884\u89C8\u5730\u5740\uFF08\u53EF\u9009\uFF09", draft2.markerImageUrl || "", 'data-cutting-marker-draft-field="markerImageUrl"')}
            ${renderTextarea("\u5907\u6CE8", draft2.note || "", 'data-cutting-marker-draft-field="note"')}
          </div>
        `
  )}
      ${renderSection(
    "\u8C03\u6574\u533A",
    `
          <div class="grid gap-3 md:grid-cols-3">
            ${renderSelect("\u662F\u5426\u6709\u8C03\u6574", draft2.adjustmentRequired ? "true" : "false", 'data-cutting-marker-draft-field="adjustmentRequired"', [
      { value: "false", label: "\u5426" },
      { value: "true", label: "\u662F" }
    ])}
          </div>
          <div class="mt-3">
            ${renderTextarea("\u8C03\u6574\u8BB0\u5F55", draft2.adjustmentNote || "", 'data-cutting-marker-draft-field="adjustmentNote"', 4)}
          </div>
        `
  )}
    </div>
  `;
}
function renderSpreadingDetailPage() {
  const pathname = getCurrentPathname();
  const meta = getCanonicalCuttingMeta(pathname, "spreading-detail");
  const row = getSpreadingRow(getSearchParams().get("sessionId"));
  if (!row) {
    return `
      <div class="space-y-3 p-4">
        ${renderCuttingPageHeader(meta, {
      actionsHtml: renderHeaderActions(appendSummaryReturnAction([
        '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">\u8FD4\u56DE\u5217\u8868</button>'
      ]))
    })}
        <section class="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">\u672A\u627E\u5230\u5BF9\u5E94\u94FA\u5E03 session\uFF0C\u8BF7\u8FD4\u56DE\u5217\u8868\u91CD\u65B0\u9009\u62E9\u3002</section>
      </div>
    `;
  }
  const pageData = getPageData();
  const detailView = buildSpreadingDetailViewModel({
    row,
    rowsById: pageData.rowsById,
    markerPlanRefs: pageData.markerPlanRefs,
    markerRecords: pageData.store.markers
  });
  const session = row.session;
  const derived = resolveSpreadingDerivedState(session);
  const linkedMarker = derived.markerRecord;
  const markerTotalPieces = derived.markerTotalPieces;
  const rollSummary = derived.rollSummary;
  const varianceSummary = derived.varianceSummary;
  const replenishmentWarning = buildSpreadingReplenishmentPreview(session, detailView.linkedCutOrderNos, derived);
  const lifecycleState = resolveSpreadingEditLifecycleState(session);
  const data = readMarkerSpreadingPrototypeData();
  const primaryRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean);
  const linkedCutOrderNos = detailView.linkedCutOrderNos;
  const productionOrderNos = Array.from(new Set(primaryRows.map((rowItem) => rowItem.productionOrderNo).filter(Boolean)));
  const colorSummaryDerived = deriveSpreadingColorSummary({
    rolls: session.rolls,
    importSourceColorSummary: session.importSource?.sourceColorSummary,
    contextColors: primaryRows.map((rowItem) => rowItem.color),
    fallbackSummary: session.colorSummary
  });
  const theoreticalSpreadTotalLength = Number(linkedMarker?.spreadTotalLength ?? session.theoreticalSpreadTotalLength ?? 0);
  const plannedSpreadLengthM = (session.planUnits || []).reduce((sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0), 0);
  const plannedSpreadLengthFormula = buildSumFormula(
    plannedSpreadLengthM,
    (session.planUnits || []).map((unit) => Number(unit.plannedSpreadLengthM || 0)),
    2
  );
  const plannedLayerTotal = Math.max(Number(session.plannedLayers || linkedMarker?.plannedLayerCount || 0), 0);
  const actualLayerTotal = Math.max(Number(rollSummary.totalLayers || session.actualLayers || 0), 0);
  const plannedUsageLengthM = theoreticalSpreadTotalLength || plannedSpreadLengthM;
  const actualUsageLengthM = rollSummary.totalActualLength;
  const theoreticalActualCutPieceQty = varianceSummary?.theoreticalCutGarmentQty ?? computeSessionPlannedCutGarmentQty(session, markerTotalPieces);
  const handoverSummaryByRollId = buildRollHandoverSummaryMap(session, markerTotalPieces);
  const webSummary = resolveWebSpreadingSummary(row, pageData.projection);
  const materialIdentity = webSummary.order?.materialIdentity || {
    materialSku: row.materialSkuSummary || session.materialSkuSummary || "\u5F85\u8865",
    materialLabel: "\u94FA\u5E03\u9762\u6599",
    materialColor: row.colorSummary || session.colorSummary || "",
    materialAlias: row.materialAliasSummary || session.materialAliasSummary || "",
    materialImageUrl: row.materialImageUrl || session.materialImageUrl || ""
  };
  const patternIdentity = webSummary.order?.patternIdentity || null;
  const writebackRecords = [
    session.sourceWritebackId ? {
      recordId: session.sourceWritebackId,
      sourceLabel: "\u94FA\u5E03\u5355\u5199\u56DE",
      updatedAt: session.updatedFromPdaAt || session.updatedAt,
      operatorName: webSummary.pda.operatorName
    } : null,
    ...session.rolls.map(
      (roll) => roll.sourceWritebackId ? {
        recordId: roll.sourceWritebackId,
        sourceLabel: `\u5E03\u5377 ${roll.rollNo || "\u5F85\u8865"} \u5199\u56DE`,
        updatedAt: roll.updatedFromPdaAt || roll.occurredAt,
        operatorName: roll.operatorNames?.join(" / ") || webSummary.pda.operatorName
      } : null
    ),
    ...session.operators.map(
      (operator) => operator.sourceWritebackId ? {
        recordId: operator.sourceWritebackId,
        sourceLabel: `${operator.operatorName || "\u4EBA\u5458"} \u5199\u56DE`,
        updatedAt: operator.updatedFromPdaAt || operator.endAt || operator.startAt,
        operatorName: operator.operatorName || webSummary.pda.operatorName
      } : null
    )
  ].filter((record) => Boolean(record));
  const differenceRuntime = {
    orders: webSummary.order ? [webSummary.order] : [],
    sessions: [session]
  };
  const spreadingDifferences = Array.from(
    new Map(
      [
        ...listSpreadingDifferencesBySpreadingOrder(session.spreadingSessionId, differenceRuntime),
        ...listSpreadingDifferencesBySpreadingOrder(session.sessionNo || "", differenceRuntime),
        ...webSummary.order?.spreadingOrderId ? listSpreadingDifferencesBySpreadingOrder(webSummary.order.spreadingOrderId, differenceRuntime) : [],
        ...webSummary.order?.spreadingOrderNo ? listSpreadingDifferencesBySpreadingOrder(webSummary.order.spreadingOrderNo, differenceRuntime) : []
      ].map((difference) => [difference.differenceId, difference])
    ).values()
  );
  const renderRollCards = () => `
    <div class="grid gap-3 lg:grid-cols-2">
      ${session.rolls.length ? session.rolls.map((roll) => {
    const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength);
    const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength);
    return `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold text-foreground">${escapeHtml(roll.rollNo || "\u5F85\u8865\u5E03\u5377\u53F7")}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(roll.materialSku || materialIdentity.materialSku || "\u5F85\u8865\u9762\u6599")}</div>
                  </div>
                  <div class="text-xs text-muted-foreground">${escapeHtml(formatScheduleDateTime(roll.occurredAt))}</div>
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  ${renderReadonlyField("\u5377\u957F", formatLength(roll.labeledLength))}
                  ${renderReadonlyField("\u4F7F\u7528\u957F\u5EA6", formatLength(roll.actualLength))}
                  ${renderReadonlyField("\u5269\u4F59\u957F\u5EA6", formatLength(remainingLength))}
                  ${renderReadonlyField("\u51C0\u53EF\u7528\u957F\u5EA6", formatLength(usableLength))}
                  ${renderReadonlyField("\u5E03\u5934\u957F\u5EA6", formatLength(roll.headLength))}
                  ${renderReadonlyField("\u5E03\u5C3E\u957F\u5EA6", formatLength(roll.tailLength))}
                  ${renderReadonlyField("\u5B9E\u94FA\u5C42\u6570", `${formatQty(roll.layerCount)} \u5C42`)}
                  ${renderReadonlyField("\u64CD\u4F5C\u4EBA", roll.operatorNames?.join(" / ") || "\u5F85\u8865")}
                </div>
              </article>
            `;
  }).join("") : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">\u6682\u65E0\u5377\u8BB0\u5F55\u3002</div>'}
    </div>
  `;
  const renderOperatorCards = () => `
    <div class="grid gap-3 lg:grid-cols-2">
      ${session.operators.length ? session.operators.map((operator) => {
    const linkedRoll = session.rolls.find((roll) => roll.rollRecordId === operator.rollRecordId) || null;
    const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer);
    return `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold text-foreground">${escapeHtml(operator.operatorName || "\u5F85\u8865\u4EBA\u5458")}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(operator.operatorAccountId || "\u5F85\u8865\u8D26\u53F7")}</div>
                  </div>
                  ${renderStatusBadge(operator.actionType || "\u5F85\u8865\u52A8\u4F5C", "border-slate-200 bg-slate-50 text-slate-700")}
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  ${renderReadonlyField("\u6240\u5C5E\u5377", linkedRoll?.rollNo || "\u5F85\u8865")}
                  ${renderReadonlyField("\u5F00\u59CB\u65F6\u95F4", formatScheduleDateTime(operator.startAt))}
                  ${renderReadonlyField("\u7ED3\u675F\u65F6\u95F4", formatScheduleDateTime(operator.endAt))}
                  ${renderReadonlyField("\u8D1F\u8D23\u5C42\u6570", handledLayerCount === null ? "\u5F85\u8865" : `${formatQty(handledLayerCount)} \u5C42`)}
                  ${renderReadonlyField("\u8BA1\u4EF6\u6570\u636E", operator.handledLength ? formatLength(operator.handledLength) : "\u5F85\u8865")}
                  ${renderReadonlyField("\u4EA4\u63A5\u5907\u6CE8", operator.note || operator.handoverNotes || "\u2014")}
                </div>
              </article>
            `;
  }).join("") : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">\u6682\u65E0\u4EBA\u5458\u8BB0\u5F55\u3002</div>'}
    </div>
  `;
  const renderPdaWritebackSection = () => `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        ${renderStatusBadge(webSummary.pda.statusLabel, webSummary.pda.statusClassName)}
        <span class="text-xs text-muted-foreground">\u6700\u8FD1\u5199\u56DE\uFF1A${escapeHtml(formatScheduleDateTime(webSummary.pda.latestAt))}</span>
        <span class="text-xs text-muted-foreground">\u5199\u56DE\u4EBA\uFF1A${escapeHtml(webSummary.pda.operatorName)}</span>
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        ${writebackRecords.length ? writebackRecords.map((record) => `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="font-semibold text-foreground">${escapeHtml(record.sourceLabel)}</div>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  ${renderReadonlyField("\u5199\u56DE\u8BB0\u5F55", record.recordId)}
                  ${renderReadonlyField("\u5199\u56DE\u65F6\u95F4", formatScheduleDateTime(record.updatedAt))}
                  ${renderReadonlyField("\u5199\u56DE\u4EBA", record.operatorName)}
                  ${renderReadonlyField("\u540C\u6B65\u72B6\u6001", webSummary.pda.statusLabel)}
                </div>
              </article>
            `).join("") : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">\u6682\u65E0 PDA \u5199\u56DE\u8BB0\u5F55\u3002</div>'}
      </div>
    </div>
  `;
  const renderDifferenceCards = () => `
    <div class="mt-3 grid gap-3">
      ${spreadingDifferences.length ? spreadingDifferences.map(
    (difference) => `
                  <article class="rounded-lg border bg-background p-3 text-sm">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderStatusBadge(difference.differenceType, difference.differenceLevel === "\u9700\u5904\u7406" ? "border-rose-200 bg-rose-50 text-rose-700" : difference.differenceLevel === "\u9700\u590D\u6838" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700")}
                        ${renderStatusBadge(difference.handlingStatus, difference.handlingStatus === "\u5F85\u5904\u7406" ? "border-amber-200 bg-amber-50 text-amber-700" : difference.handlingStatus === "\u5DF2\u5904\u7406" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700")}
                        <span class="text-xs text-muted-foreground">${escapeHtml(difference.sourceType)}</span>
                      </div>
                      <span class="text-xs text-muted-foreground">${escapeHtml(formatScheduleDateTime(difference.detectedAt))}</span>
                    </div>
                    <div class="mt-2 grid gap-2 sm:grid-cols-4">
                      ${renderReadonlyField("\u8BA1\u5212\u503C", `${formatQty(difference.plannedValue)} ${difference.unit}`)}
                      ${renderReadonlyField("\u5B9E\u9645\u503C", `${formatQty(difference.actualValue)} ${difference.unit}`)}
                      ${renderReadonlyField("\u5DEE\u5F02\u503C", `${formatQty(Math.abs(difference.differenceValue))} ${difference.unit}`)}
                      ${renderReadonlyField("\u5173\u8054\u8865\u6599\u5904\u7406", difference.linkedReplenishmentId)}
                    </div>
                    <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(difference.evidence.summary)}</p>
                  </article>
                `
  ).join("") : webSummary.needsReview ? `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  ${renderStatusBadge("\u7CFB\u7EDF\u8BA1\u7B97\u5DEE\u5F02", "border-amber-200 bg-amber-50 text-amber-700")}
                  ${renderStatusBadge("\u5F85\u5904\u7406", "border-amber-200 bg-amber-50 text-amber-700")}
                </div>
                <div class="mt-2 grid gap-2 sm:grid-cols-3">
                  ${renderReadonlyField("\u5C42\u6570\u5DEE\u5F02", formatSignedNumber(webSummary.layerDiff, "\u5C42"))}
                  ${renderReadonlyField("\u7528\u91CF\u5DEE\u5F02", formatSignedLength(webSummary.usageDiff))}
                  ${renderReadonlyField("\u6570\u91CF\u5DEE\u5F02", formatSignedNumber(webSummary.qtyDiff, "\u4EF6"))}
                </div>
                <p class="mt-2 text-xs text-muted-foreground">\u8BE5\u94FA\u5E03\u5355\u5B58\u5728\u8BA1\u5212\u4E0E\u5B9E\u9645\u5DEE\u5F02\uFF0C\u5141\u8BB8\u63D0\u4EA4\u73B0\u573A\u6570\u636E\uFF0C\u540E\u7EED\u8FDB\u5165\u8865\u6599\u7BA1\u7406\u5224\u65AD\u662F\u5426\u8865\u6599\u3001\u8865\u5F55\u3001\u8865\u6392\u3001\u5173\u95ED\u88C1\u7247\u5355\u6216\u4EC5\u8BB0\u5F55\u3002</p>
              </article>
            ` : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">\u5F53\u524D\u6CA1\u6709\u5DF2\u751F\u6210\u7684\u94FA\u5E03\u6216\u88C1\u526A\u5DEE\u5F02\u4E8B\u9879\u3002</div>'}
    </div>
  `;
  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-detail-page">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: renderHeaderActions(appendSummaryReturnAction([
      '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">\u8FD4\u56DE\u94FA\u5E03\u5355</button>',
      `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">\u5904\u7406\u5DEE\u5F02</button>`,
      `${row.markerPlanNo ? `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-plan" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u53BB\u6765\u6E90\u551B\u67B6\u65B9\u6848</button>` : ""}`
    ]))
  })}
      <section class="rounded-xl border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-blue-600">${escapeHtml(session.sessionNo || "\u5F85\u8865\u94FA\u5E03\u5355\u53F7")}</div>
            <div class="mt-1 text-xs text-muted-foreground">\u551B\u67B6\u65B9\u6848\uFF1A${escapeHtml(session.sourceSchemeNo || row.markerPlanNo || "\u5F85\u5173\u8054")} / \u551B\u67B6\u7F16\u53F7\uFF1A${escapeHtml(session.sourceBedNo || session.markerNo || row.sourceMarkerLabel || "\u5F85\u8865")}</div>
          </div>
          <div class="flex flex-wrap gap-2">${renderStatusBadge(webSummary.status.label, webSummary.status.className)}</div>
        </div>
      </section>
      ${renderSection("\u57FA\u672C\u4FE1\u606F", `
        <div class="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>${renderMaterialIdentityBlock(materialIdentity, { compact: true, imageSizeClass: "h-12 w-12", showCategory: false })}</div>
          <div class="space-y-2 text-sm">
            ${renderReadonlyField("\u6765\u6E90\u88C1\u7247\u5355", (webSummary.order?.sourceCutOrderNos || linkedCutOrderNos).join(" / ") || "\u5F85\u8865")}
            ${renderReadonlyField("\u751F\u4EA7\u5355", productionOrderNos.join(" / ") || row.productionOrderNos.join(" / ") || "\u5F85\u8865")}
            ${renderReadonlyField("\u94FA\u5E03\u8D1F\u8D23\u4EBA", session.ownerName || "\u5F85\u5206\u914D")}
          </div>
          <div class="space-y-2 text-sm">
            ${renderReadonlyField("\u7EB8\u6837\u6587\u4EF6", patternIdentity?.patternFileName || "\u5F85\u8865")}
            ${renderReadonlyField("\u7EB8\u6837\u7248\u672C", patternIdentity?.patternVersion || "\u5F85\u8865")}
            ${renderReadonlyField("\u6709\u6548\u5E45\u5BBD", patternIdentity?.effectiveWidthText || webSummary.order?.effectiveWidth || "\u5F85\u8865")}
          </div>
        </div>
      `)}
      ${renderSection("\u8BA1\u5212\u4FE1\u606F", `
        ${renderInfoGrid([
    { label: "\u8BA1\u5212\u5C42\u6570", value: `${formatQty(webSummary.plannedLayerCount)} \u5C42` },
    { label: "\u8BA1\u5212\u7528\u91CF", value: formatLength(webSummary.plannedUsage) },
    { label: "\u8BA1\u5212\u6570\u91CF", value: `${formatQty(webSummary.plannedQty)} \u4EF6` },
    { label: "\u5C3A\u7801\u914D\u6BD4", value: webSummary.order?.sizeRatio || linkedMarker?.sizeRatioPlanText || "\u5F85\u8865" },
    { label: "\u551B\u67B6\u56FE\u7247", value: webSummary.order?.markerImageUrl || linkedMarker?.markerImageUrl || "\u5F85\u4E0A\u4F20" }
  ])}
      `)}
      ${renderSection("\u5B9E\u9645\u4FE1\u606F", `
        ${renderInfoGrid([
    { label: "\u5B9E\u94FA\u5C42\u6570", value: `${formatQty(webSummary.actualLayerCount)} \u5C42`, formula: buildLayerSumFormula(webSummary.actualLayerCount, session.rolls.map((roll) => roll.layerCount)) },
    { label: "\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6", value: formatLength(webSummary.actualUsage), formula: buildSumFormula(webSummary.actualUsage, session.rolls.map((roll) => roll.actualLength), 2) },
    { label: "\u5B9E\u9645\u7528\u91CF", value: formatLength(webSummary.actualUsage) },
    { label: "\u5B9E\u9645\u88C1\u526A\u6570\u91CF", value: `${formatQty(webSummary.actualCutQty)} \u4EF6` },
    { label: "\u5E03\u5934\u957F\u5EA6", value: formatLength(rollSummary.totalHeadLength) },
    { label: "\u5E03\u5C3E\u957F\u5EA6", value: formatLength(rollSummary.totalTailLength) }
  ])}
      `)}
      ${renderSection("\u5377\u8BB0\u5F55", renderRollCards())}
      ${renderSection("\u4EBA\u5458\u8BB0\u5F55", renderOperatorCards())}
      ${renderSection("PDA \u5199\u56DE\u8BB0\u5F55", renderPdaWritebackSection())}
      ${renderSection("\u5DEE\u5F02\u4E0E\u540E\u7EED\u52A8\u4F5C", `
        ${renderInfoGrid([
    { label: "\u5C42\u6570\u5DEE\u5F02", value: formatSignedNumber(webSummary.layerDiff, "\u5C42") },
    { label: "\u7528\u91CF\u5DEE\u5F02", value: formatSignedLength(webSummary.usageDiff) },
    { label: "\u6570\u91CF\u5DEE\u5F02", value: formatSignedNumber(webSummary.qtyDiff, "\u4EF6") },
    { label: "\u590D\u6838\u5224\u65AD", value: webSummary.needsReview ? "\u9700\u8981\u590D\u6838" : "\u65E0\u9700\u590D\u6838" },
    { label: "\u5DEE\u5F02\u8BF4\u660E", value: row.varianceNote || "\u5F53\u524D\u672A\u8BC6\u522B\u660E\u663E\u5DEE\u5F02\u3002" }
  ])}
        ${renderDifferenceCards()}
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">\u8FDB\u5165\u5DEE\u5F02\u5904\u7406</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-cut-orders" data-session-id="${escapeHtml(session.spreadingSessionId)}">\u67E5\u770B\u6765\u6E90\u88C1\u7247\u5355</button>
        </div>
      `)}
    </div>
  `;
  const renderTopInfo = () => `
    <section class="rounded-xl border bg-card p-4">
      <div class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div><div class="text-[11px] text-muted-foreground">\u94FA\u5E03\u7F16\u53F7</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(session.sessionNo || "\u5F85\u8865")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u6765\u6E90\u551B\u67B6\u7F16\u53F7</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.sourceBedNo || session.markerNo || "\u672A\u5173\u8054\u551B\u67B6\u7F16\u53F7")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u88C1\u5E8A</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.cuttingTableName || session.cuttingTableNo || "\u672A\u6392\u7A0B")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u5B9E\u9645\u5F00\u59CB</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.actualStartAt || "\u672A\u5F00\u59CB")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u5B9E\u9645\u7ED3\u675F</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.actualEndAt || "\u672A\u5B8C\u6210")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u88C1\u7247\u5355 / \u551B\u67B6\u65B9\u6848</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(linkedCutOrderNos.join(" / ") || session.markerPlanNo || "\u2014")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u751F\u4EA7\u5355</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(productionOrderNos.join(" / ") || "\u2014")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u6A21\u5F0F</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(deriveSpreadingModeMeta(session.spreadingMode).label)}</div></div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${renderStatusBadge(lifecycleState.mainStageLabel, lifecycleState.mainStageClassName)}
            ${lifecycleState.cuttingStatusLabel ? renderStatusBadge(lifecycleState.cuttingStatusLabel, lifecycleState.cuttingStatusClassName) : ""}
          </div>
        </div>
        ${session.status === "DRAFT" ? `<div class="rounded-lg border bg-blue-50/40 px-3 py-3">${renderStartSpreadingControls(session.spreadingSessionId, session.cuttingTableId, session.ownerAccountId)}</div>` : ""}
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(plannedLayerTotal)} \u5C42`, `${formatQty(plannedLayerTotal)} \u5C42 = \u551B\u67B6\u65B9\u6848\u8BA1\u5212\u5C42\u6570`)}<div class="mt-1 text-[11px] text-muted-foreground">\u8BA1\u5212\u5C42\u6570</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(actualLayerTotal)} \u5C42`, buildLayerSumFormula(actualLayerTotal, session.rolls.map((roll) => roll.layerCount)))}<div class="mt-1 text-[11px] text-muted-foreground">\u5B9E\u94FA\u5C42\u6570</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(formatLength(plannedUsageLengthM), theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula)}<div class="mt-1 text-[11px] text-muted-foreground">\u8BA1\u5212\u7528\u91CF</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(formatLength(actualUsageLengthM), buildSumFormula(actualUsageLengthM, session.rolls.map((roll) => roll.actualLength), 2))}<div class="mt-1 text-[11px] text-muted-foreground">\u5B9E\u9645\u7528\u91CF</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6`, varianceSummary?.plannedCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, session.plannedLayers || 0, markerTotalPieces))}<div class="mt-1 text-[11px] text-muted-foreground">\u8BA1\u5212\u6570\u91CF</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(varianceSummary?.actualCutGarmentQty || 0)} \u4EF6`, varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []))}<div class="mt-1 text-[11px] text-muted-foreground">\u5B9E\u9645\u88C1\u526A\u6570\u91CF</div></div>
        </div>
      </div>
    </section>
  `;
  const renderSummaryTab = () => renderSection(
    "\u6267\u884C\u6458\u8981",
    `
        ${renderInfoGrid([
      {
        label: "\u8BA1\u5212\u5C42\u6570",
        value: `${formatQty(plannedLayerTotal)} \u5C42`,
        formula: `${formatQty(plannedLayerTotal)} \u5C42 = \u551B\u67B6\u65B9\u6848\u8BA1\u5212\u5C42\u6570`
      },
      {
        label: "\u5B9E\u94FA\u5C42\u6570",
        value: `${formatQty(actualLayerTotal)} \u5C42`,
        formula: buildLayerSumFormula(actualLayerTotal, session.rolls.map((roll) => roll.layerCount))
      },
      {
        label: "\u8BA1\u5212\u6570\u91CF",
        value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.plannedCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, session.plannedLayers || 0, markerTotalPieces)
      },
      {
        label: "\u7406\u8BBA\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(theoreticalActualCutPieceQty)} \u4EF6`,
        formula: varianceSummary?.theoreticalCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(theoreticalActualCutPieceQty, session.plannedLayers || 0, markerTotalPieces)
      },
      {
        label: "\u5B9E\u9645\u88C1\u526A\u6570\u91CF",
        value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, [])
      },
      {
        label: "\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0)
      },
      {
        label: "\u8BA1\u5212\u7528\u91CF",
        value: formatLength(plannedUsageLengthM),
        formula: theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula
      },
      {
        label: "\u5B9E\u9645\u7528\u91CF",
        value: formatLength(actualUsageLengthM),
        formula: buildSumFormula(actualUsageLengthM, session.rolls.map((roll) => roll.actualLength), 2)
      },
      {
        label: "\u603B\u51C0\u53EF\u7528\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.spreadUsableLengthM || rollSummary.totalCalculatedUsableLength),
        formula: varianceSummary?.spreadUsableLengthFormula || buildSumFormula(rollSummary.totalCalculatedUsableLength, session.rolls.map((roll) => computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)), 2)
      },
      {
        label: "\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.claimedLengthTotal || 0),
        formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = \u03A3 \u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6`
      },
      {
        label: "\u5DEE\u5F02\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.varianceLength || 0),
        formula: varianceSummary?.varianceLengthFormula || buildDifferenceFormula(varianceSummary?.varianceLength || 0, varianceSummary?.claimedLengthTotal || 0, rollSummary.totalActualLength, 2)
      },
      { label: "Session \u5907\u6CE8", value: session.note || "\u2014" }
    ])}
      `
  );
  const renderRollsTab = () => !canEditSpreadingExecution(draft) ? renderSection("\u5377\u8BB0\u5F55", renderStartSpreadingGate("\u5377\u8BB0\u5F55")) : renderSection(
    "\u5377\u8BB0\u5F55",
    `
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">\u551B\u67B6\u9879</th>
                <th class="px-3 py-3">\u5377\u53F7</th>
                <th class="px-3 py-3">\u9762\u6599</th>
                <th class="px-3 py-3">\u989C\u8272</th>
                <th class="px-3 py-3">\u6807\u6CE8\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5E03\u5934\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5E03\u5C3E\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u94FA\u5E03\u5C42\u6570\uFF08\u5C42\uFF09</th>
                <th class="px-3 py-3">\u51C0\u53EF\u7528\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5269\u4F59\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u5F55\u5165\u6765\u6E90</th>
                <th class="px-3 py-3">\u8BB0\u5F55\u65F6\u95F4</th>
                <th class="px-3 py-3">\u5907\u6CE8</th>
              </tr>
            </thead>
            <tbody>
              ${session.rolls.length ? session.rolls.map((roll) => {
      const planUnit = findSpreadingPlanUnitById(session.planUnits, roll.planUnitId);
      const garmentQtyPerUnit = planUnit?.garmentQtyPerUnit || 0;
      const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength);
      const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength);
      const actualCutGarmentQty = computeRollActualCutGarmentQty(roll.layerCount, garmentQtyPerUnit);
      return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(planUnit ? buildSpreadingPlanUnitLabel(planUnit) : "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${escapeHtml(roll.rollNo || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
        materialSku: planUnit?.materialSku || roll.materialSku || "\u2014",
        materialLabel: planUnit?.materialSku || roll.materialSku || "\u2014",
        materialAlias: planUnit?.materialAlias || "",
        materialImageUrl: planUnit?.materialImageUrl || ""
      }, { compact: true })}</td>
                            <td class="px-3 py-3">${escapeHtml(planUnit?.color || roll.color || "\u2014")}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.labeledLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.actualLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.headLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.tailLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(`${formatQty(roll.layerCount)} \u5C42`)}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(usableLength), buildRollUsableLengthFormula(roll.actualLength, roll.headLength, roll.tailLength, usableLength), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(remainingLength), buildRemainingLengthFormula(roll.labeledLength, roll.actualLength, remainingLength), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(actualCutGarmentQty)} \u4EF6`, buildRollActualCutGarmentQtyFormula(actualCutGarmentQty, roll.layerCount, garmentQtyPerUnit), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(getSourceChannelDisplayLabel(roll.sourceChannel))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatDateText(roll.occurredAt || ""))}</td>
                            <td class="px-3 py-3">${escapeHtml(roll.note || "\u2014")}</td>
                          </tr>
                        `;
    }).join("") : '<tr><td colspan="15" class="px-3 py-6 text-center text-xs text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u5377\u8BB0\u5F55\u3002</td></tr>'}
            </tbody>
          </table>
        </div>
        ${renderSpreadingOutputMatrix(session.spreadingSessionId)}
      `
  );
  const renderOperatorsTab = () => !canEditSpreadingExecution(draft) ? renderSection("\u6362\u73ED\u4E0E\u4EBA\u5458", renderStartSpreadingGate("\u6362\u73ED\u4E0E\u4EBA\u5458")) : renderSection(
    "\u6362\u73ED\u4E0E\u4EBA\u5458",
    `
        <details open class="rounded-md border bg-background" data-testid="cutting-spreading-detail-operators-fold" data-default-open="open">
          <summary class="cursor-pointer px-2.5 py-1.5 text-sm font-medium text-foreground">\u6362\u73ED\u660E\u7EC6\u6458\u8981</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-[1560px] text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">\u6240\u5C5E\u5377</th>
                <th class="px-3 py-3">\u64CD\u4F5C\u8D26\u53F7</th>
                <th class="px-3 py-3">\u64CD\u4F5C\u4EBA</th>
                <th class="px-3 py-3">\u52A8\u4F5C\u7C7B\u578B</th>
                <th class="px-3 py-3">\u5F00\u59CB\u5C42</th>
                <th class="px-3 py-3">\u7ED3\u675F\u5C42</th>
                <th class="px-3 py-3">\u8D1F\u8D23\u5C42\u6570\uFF08\u5C42\uFF09</th>
                <th class="px-3 py-3">\u8D1F\u8D23\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u8D1F\u8D23\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u63A5\u624B\u4EBA\u8D26\u53F7</th>
                <th class="px-3 py-3">\u8BB0\u5F55\u65F6\u95F4</th>
                <th class="px-3 py-3">\u5907\u6CE8</th>
              </tr>
            </thead>
            <tbody>
              ${session.operators.length ? session.operators.map((operator) => {
      const linkedRoll = session.rolls.find((roll) => roll.rollRecordId === operator.rollRecordId) || null;
      const linkedUnit = linkedRoll ? findSpreadingPlanUnitById(session.planUnits, linkedRoll.planUnitId) : null;
      const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer);
      const handledGarmentQty = computeOperatorHandledGarmentQty(handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0);
      const handledLength = computeOperatorHandledLengthByRoll(handledLayerCount, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0);
      return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(linkedRoll?.rollNo || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.operatorAccountId || "\u2014")}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.operatorName || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.actionType || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLayerValue(operator.startLayer))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLayerValue(operator.endLayer))}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLayerCount === null ? "\u5F85\u8865" : `${formatQty(handledLayerCount)} \u5C42`, buildOperatorHandledLayerFormula(handledLayerCount, operator.startLayer, operator.endLayer), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledGarmentQty === null ? "\u5F85\u8865" : `${formatQty(handledGarmentQty)} \u4EF6`, buildOperatorHandledGarmentQtyFormula(handledGarmentQty, handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLength === null ? "\u5F85\u8865" : formatLength(handledLength), buildOperatorHandledLengthFormula(handledLength, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0, handledLayerCount), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.nextOperatorAccountId || "\u2014")}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.endAt || operator.startAt || "\u2014")}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.note || operator.handoverNotes || "\u2014")}</td>
                          </tr>
                        `;
    }).join("") : '<tr><td colspan="12" class="px-3 py-6 text-center text-xs text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u6362\u73ED\u4E0E\u4EBA\u5458\u8BB0\u5F55\u3002</td></tr>'}
            </tbody>
          </table>
          </div>
        </details>
        <div class="mt-2 space-y-2">
          ${Object.values(handoverSummaryByRollId).length ? Object.values(handoverSummaryByRollId).map(
      (summary) => `
                      <div class="rounded-lg border bg-muted/10 p-2.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="text-sm font-medium text-foreground">\u5377 ${escapeHtml(summary.rollNo || "\u5F85\u8865")}</div>
                          ${renderRollHandoverStatus(summary)}
                        </div>
                        <div class="mt-2">${renderRollHandoverWarnings(summary)}</div>
                      </div>
                    `
    ).join("") : ""}
        </div>
      `
  );
  const renderVarianceTab = () => renderSection(
    "\u5DEE\u5F02\u4E0E\u8865\u6599",
    `
        ${renderInfoGrid([
      {
        label: "\u9700\u6C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.plannedCutGarmentQtyFormula || `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6 = \u5F53\u524D\u9700\u6C42\u6210\u8863\u4EF6\u6570`
      },
      {
        label: "\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, [])
      },
      {
        label: "\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0)
      },
      {
        label: "\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.claimedLengthTotal || 0),
        formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = \u03A3 \u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6`
      },
      {
        label: "\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.spreadActualLengthM || 0),
        formula: buildSumFormula(rollSummary.totalActualLength, session.rolls.map((roll) => roll.actualLength), 2)
      },
      {
        label: "\u5DEE\u5F02\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.varianceLength || 0),
        formula: varianceSummary?.varianceLengthFormula || buildDifferenceFormula(0, 0, 0, 2)
      }
    ])}
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h4 class="text-sm font-semibold text-foreground">\u5DEE\u5F02\u5904\u7406\u9879</h4>
          <button type="button" class="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">\u53BB\u8865\u6599\u7BA1\u7406</button>
        </div>
        <details class="mt-2 rounded-md border bg-background" data-testid="cutting-spreading-detail-replenishment-fold" data-default-open="collapsed">
          <summary class="cursor-pointer px-2.5 py-1.5 text-sm font-medium text-foreground">\u5DEE\u5F02\u5904\u7406\u6458\u8981</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">\u88C1\u7247\u5355</th>
                <th class="px-3 py-3">\u9762\u6599</th>
                <th class="px-3 py-3">\u989C\u8272</th>
                <th class="px-3 py-3">\u9700\u6C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u9884\u8B66\u7B49\u7EA7</th>
                <th class="px-3 py-3">\u5EFA\u8BAE\u52A8\u4F5C</th>
                <th class="px-3 py-3">\u64CD\u4F5C</th>
              </tr>
            </thead>
            <tbody>
              ${replenishmentWarning.lines.length ? replenishmentWarning.lines.map((line) => {
      const warningLevel = line.shortageGarmentQty > 0 || line.actualLengthTotal > line.claimedLengthTotal ? "\u9AD8" : "\u4F4E";
      return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(line.cutOrderNo || line.cutOrderId)}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
        materialSku: line.materialSku,
        materialLabel: line.materialSku,
        materialAlias: line.materialAlias,
        materialImageUrl: line.materialImageUrl
      }, { compact: true })}</td>
                            <td class="px-3 py-3">${escapeHtml(line.color || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.requiredGarmentQty)} \u4EF6`, `${formatQty(line.requiredGarmentQty)} \u4EF6 = \u5F53\u524D\u884C\u9700\u6C42\u6210\u8863\u4EF6\u6570`, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.actualCutGarmentQty)} \u4EF6`, line.actualCutGarmentQtyFormula, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.shortageGarmentQty)} \u4EF6`, line.shortageGarmentQtyFormula, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${formatLength(line.claimedLengthTotal)}</td>
                            <td class="px-3 py-3">${formatLength(line.actualLengthTotal)}</td>
                            <td class="px-3 py-3">${renderStatusBadge(
        warningLevel,
        warningLevel === "\u9AD8" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
      )}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(line.suggestedAction, line.suggestedActionRuleText, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">
                              <button
                                type="button"
                                class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                                data-cutting-marker-action="launch-line-replenishment"
                                data-session-id="${escapeHtml(session.spreadingSessionId)}"
                                data-cut-order-id="${escapeHtml(line.cutOrderId)}"
                                data-cut-order-no="${escapeHtml(line.cutOrderNo)}"
                                data-material-sku="${escapeHtml(line.materialSku)}"
                                data-color="${escapeHtml(line.color || "")}"
                              >
                                \u53D1\u8D77\u8865\u6599
                              </button>
                            </td>
                          </tr>
                        `;
    }).join("") : '<tr><td colspan="11" class="px-3 py-6 text-center text-xs text-muted-foreground">\u5F53\u524D\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u5DEE\u5F02\u5904\u7406\u9879\u3002</td></tr>'}
            </tbody>
          </table>
          </div>
        </details>
      `
  );
  const content = state.spreadingEditTab === "rolls" ? renderRollsTab() : state.spreadingEditTab === "operators" ? renderOperatorsTab() : state.spreadingEditTab === "variance" ? renderVarianceTab() : renderSummaryTab();
  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-detail-page">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: renderHeaderActions(appendSummaryReturnAction([
      '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">\u8FD4\u56DE\u5217\u8868</button>',
      `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u53BB\u7F16\u8F91</button>`,
      `${row.session.markerId ? `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-detail" data-marker-id="${escapeHtml(row.session.markerId)}">\u53BB\u6765\u6E90\u551B\u67B6\u7F16\u53F7</button>` : ""}`,
      `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-cut-orders" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u53BB\u6765\u6E90\u88C1\u7247\u5355</button>`,
      `${row.markerPlanNo ? `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-plan" data-session-id="${escapeHtml(row.spreadingSessionId)}">\u53BB\u6765\u6E90\u551B\u67B6\u65B9\u6848</button>` : ""}`
    ]))
  })}
      ${renderTopInfo()}
      ${renderSpreadingEditTabNav(state.spreadingEditTab)}
      ${content}
    </div>
  `;
}
function resolveSpreadingEditLifecycleState(draft2) {
  const mainStageMeta = deriveSpreadingListStatus(draft2.status);
  const cuttingStatusMeta = draft2.cuttingStatus || draft2.status === "DONE" ? deriveSpreadingCuttingStatus(draft2.cuttingStatus || "WAITING_CUTTING") : null;
  return {
    mainStageLabel: mainStageMeta.label,
    mainStageClassName: mainStageMeta.className,
    cuttingStatusLabel: cuttingStatusMeta?.label || "",
    cuttingStatusClassName: cuttingStatusMeta?.className || ""
  };
}
function canEditSpreadingExecution(draft2) {
  return draft2.status !== "DRAFT" && draft2.status !== "TO_FILL";
}
function renderStartSpreadingGate(targetLabel) {
  const session = state.spreadingDraft;
  return `
    <div class="rounded-lg border border-dashed bg-muted/10 px-4 py-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-muted-foreground">\u5F00\u59CB\u94FA\u5E03\u540E\u5F55\u5165${escapeHtml(targetLabel)}\u3002</div>
        ${session ? renderStartSpreadingControls(session.spreadingSessionId, session.cuttingTableId, session.ownerAccountId) : ""}
      </div>
    </div>
  `;
}
function ensureCanEditCurrentSpreadingExecution() {
  if (!state.spreadingDraft || canEditSpreadingExecution(state.spreadingDraft)) return true;
  state.feedback = { tone: "warning", message: "\u8BF7\u5148\u70B9\u51FB\u5F00\u59CB\u94FA\u5E03\uFF0C\u518D\u5F55\u5165\u5377\u8BB0\u5F55\u548C\u6362\u73ED\u4E0E\u4EBA\u5458\u3002" };
  return false;
}
function renderSpreadingEditPage() {
  const pathname = getCurrentPathname();
  const fallbackMetaKey = pathname === getCanonicalCuttingPath("spreading-create") ? "spreading-create" : "spreading-edit";
  const meta = getCanonicalCuttingMeta(pathname, fallbackMetaKey);
  const draft2 = state.spreadingDraft || buildNewSpreadingDraft();
  const data = readMarkerSpreadingPrototypeData();
  const primaryRows = draft2.cutOrderIds.map((id) => data.rowsById[id]).filter((row) => Boolean(row));
  const linkedCutOrderNos = draft2.cutOrderIds.map((id) => data.rowsById[id]?.cutOrderNo || id).filter(Boolean);
  const productionOrderNos = Array.from(new Set(primaryRows.map((row) => row.productionOrderNo).filter(Boolean)));
  const derived = resolveSpreadingDerivedState(draft2);
  const linkedMarker = derived.markerRecord;
  const markerTotalPieces = derived.markerTotalPieces;
  const rollSummary = derived.rollSummary;
  const varianceSummary = derived.varianceSummary;
  const colorSummaryDerived = deriveSpreadingColorSummary({
    rolls: draft2.rolls,
    importSourceColorSummary: draft2.importSource?.sourceColorSummary,
    contextColors: primaryRows.map((row) => row.color),
    fallbackSummary: draft2.colorSummary
  });
  const theoreticalSpreadTotalLength = Number(linkedMarker?.spreadTotalLength ?? draft2.theoreticalSpreadTotalLength ?? 0);
  const theoreticalActualCutPieceQty = varianceSummary?.theoreticalCutGarmentQty ?? computeSessionPlannedCutGarmentQty(draft2, markerTotalPieces);
  const replenishmentWarning = buildSpreadingReplenishmentPreview(draft2, linkedCutOrderNos, derived);
  const handoverSummaryByRollId = buildRollHandoverSummaryMap(draft2, derived.markerTotalPieces);
  const lifecycleState = resolveSpreadingEditLifecycleState(draft2);
  const plannedSpreadLengthM = (draft2.planUnits || []).reduce((sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0), 0);
  const plannedSpreadLengthFormula = buildSumFormula(
    plannedSpreadLengthM,
    (draft2.planUnits || []).map((unit) => Number(unit.plannedSpreadLengthM || 0)),
    2
  );
  const plannedLayerTotal = Math.max(Number(draft2.plannedLayers || linkedMarker?.plannedLayerCount || 0), 0);
  const actualLayerTotal = Math.max(Number(rollSummary.totalLayers || draft2.actualLayers || 0), 0);
  const plannedUsageLengthM = theoreticalSpreadTotalLength || plannedSpreadLengthM;
  const actualUsageLengthM = rollSummary.totalActualLength;
  const renderTopInfo = () => `
    <section class="rounded-lg border bg-card px-2 py-1.5">
      <div class="space-y-2">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <div><div class="text-[11px] text-muted-foreground">\u94FA\u5E03\u7F16\u53F7</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(draft2.sessionNo || "\u5F85\u8865")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u6765\u6E90\u551B\u67B6\u7F16\u53F7</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(draft2.sourceBedNo || draft2.markerNo || "\u672A\u5173\u8054\u551B\u67B6\u7F16\u53F7")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u88C1\u7247\u5355 / \u551B\u67B6\u65B9\u6848</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(linkedCutOrderNos.join(" / ") || draft2.markerPlanNo || "\u2014")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u751F\u4EA7\u5355</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(productionOrderNos.join(" / ") || "\u2014")}</div></div>
            <div><div class="text-[11px] text-muted-foreground">\u6A21\u5F0F</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(deriveSpreadingModeMeta(draft2.spreadingMode).label)}</div></div>
          </div>
          <div class="flex flex-wrap gap-1">
            ${renderStatusBadge(lifecycleState.mainStageLabel, lifecycleState.mainStageClassName)}
            ${lifecycleState.cuttingStatusLabel ? renderStatusBadge(lifecycleState.cuttingStatusLabel, lifecycleState.cuttingStatusClassName) : ""}
          </div>
        </div>
        <div class="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-6">
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(plannedLayerTotal)} \u5C42`, `${formatQty(plannedLayerTotal)} \u5C42 = \u551B\u67B6\u65B9\u6848\u8BA1\u5212\u5C42\u6570`)}<div class="mt-0.5 text-[11px] text-muted-foreground">\u8BA1\u5212\u5C42\u6570</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(actualLayerTotal)} \u5C42`, buildLayerSumFormula(actualLayerTotal, draft2.rolls.map((roll) => roll.layerCount)))}<div class="mt-0.5 text-[11px] text-muted-foreground">\u5B9E\u94FA\u5C42\u6570</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(formatLength(plannedUsageLengthM), theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula)}<div class="mt-0.5 text-[11px] text-muted-foreground">\u8BA1\u5212\u7528\u91CF</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(formatLength(actualUsageLengthM), buildSumFormula(actualUsageLengthM, draft2.rolls.map((roll) => roll.actualLength), 2))}<div class="mt-0.5 text-[11px] text-muted-foreground">\u5B9E\u9645\u7528\u91CF</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6`, varianceSummary?.plannedCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, draft2.plannedLayers || 0, markerTotalPieces))}<div class="mt-0.5 text-[11px] text-muted-foreground">\u8BA1\u5212\u6570\u91CF</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(varianceSummary?.actualCutGarmentQty || 0)} \u4EF6`, varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []))}<div class="mt-0.5 text-[11px] text-muted-foreground">\u5B9E\u9645\u88C1\u526A\u6570\u91CF</div></div>
        </div>
        ${draft2.status === "DRAFT" ? `<div class="rounded-lg border bg-blue-50/40 px-3 py-3">${renderStartSpreadingControls(draft2.spreadingSessionId, draft2.cuttingTableId, draft2.ownerAccountId)}</div>` : ""}
      </div>
    </section>
  `;
  const renderSummaryTab = () => renderSection(
    "\u6267\u884C\u6458\u8981",
    `
        ${renderInfoGrid([
      {
        label: "\u8BA1\u5212\u5C42\u6570",
        value: `${formatQty(plannedLayerTotal)} \u5C42`,
        formula: `${formatQty(plannedLayerTotal)} \u5C42 = \u551B\u67B6\u65B9\u6848\u8BA1\u5212\u5C42\u6570`
      },
      {
        label: "\u5B9E\u94FA\u5C42\u6570",
        value: `${formatQty(actualLayerTotal)} \u5C42`,
        formula: buildLayerSumFormula(actualLayerTotal, draft2.rolls.map((roll) => roll.layerCount))
      },
      {
        label: "\u8BA1\u5212\u6570\u91CF",
        value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.plannedCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, draft2.plannedLayers || 0, markerTotalPieces)
      },
      {
        label: "\u7406\u8BBA\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(theoreticalActualCutPieceQty)} \u4EF6`,
        formula: varianceSummary?.theoreticalCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(theoreticalActualCutPieceQty, draft2.plannedLayers || 0, markerTotalPieces)
      },
      {
        label: "\u5B9E\u9645\u88C1\u526A\u6570\u91CF",
        value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, [])
      },
      {
        label: "\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0)
      },
      {
        label: "\u8BA1\u5212\u7528\u91CF",
        value: formatLength(plannedUsageLengthM),
        formula: theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula
      },
      {
        label: "\u5B9E\u9645\u7528\u91CF",
        value: formatLength(actualUsageLengthM),
        formula: buildSumFormula(actualUsageLengthM, draft2.rolls.map((roll) => roll.actualLength), 2)
      },
      {
        label: "\u603B\u51C0\u53EF\u7528\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.spreadUsableLengthM || rollSummary.totalCalculatedUsableLength),
        formula: varianceSummary?.spreadUsableLengthFormula || buildSumFormula(rollSummary.totalCalculatedUsableLength, draft2.rolls.map((roll) => computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)), 2)
      },
      {
        label: "\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.claimedLengthTotal || 0),
        formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = \u03A3 \u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6`
      },
      {
        label: "\u5DEE\u5F02\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.varianceLength || 0),
        formula: varianceSummary?.varianceLengthFormula || buildDifferenceFormula(varianceSummary?.varianceLength || 0, varianceSummary?.claimedLengthTotal || 0, rollSummary.totalActualLength, 2)
      }
    ])}
        <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          ${renderReadonlyField("\u88C1\u5E8A", draft2.cuttingTableName || draft2.cuttingTableNo || "\u2014")}
          ${renderReadonlyField("\u5B9E\u9645\u5F00\u59CB\u65F6\u95F4", formatScheduleDateTime(draft2.actualStartAt))}
          ${renderReadonlyField("\u5B9E\u9645\u7ED3\u675F\u65F6\u95F4", formatScheduleDateTime(draft2.actualEndAt))}
          ${renderReadonlyField("\u8D1F\u8D23\u4EBA", draft2.ownerName || "\u672A\u5206\u914D")}
        </div>
        <div class="mt-3">
          ${renderTextarea("Session \u5907\u6CE8", draft2.note || "", 'data-cutting-spreading-draft-field="note"', 3)}
        </div>
      `
  );
  const renderRollsTab = () => renderSection(
    "\u5377\u8BB0\u5F55",
    `
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-roll">\u65B0\u589E\u5377\u8BB0\u5F55</button>
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="sync-spreading-rolls-from-pda">\u540C\u6B65\u56DE\u5199</button>
          </div>
        </div>
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">\u551B\u67B6\u9879</th>
                <th class="px-3 py-3">\u5377\u53F7</th>
                <th class="px-3 py-3">\u9762\u6599</th>
                <th class="px-3 py-3">\u989C\u8272</th>
                <th class="px-3 py-3">\u6807\u6CE8\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5E03\u5934\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5E03\u5C3E\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u94FA\u5E03\u5C42\u6570\uFF08\u5C42\uFF09</th>
                <th class="px-3 py-3">\u51C0\u53EF\u7528\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5269\u4F59\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u5F55\u5165\u6765\u6E90</th>
                <th class="px-3 py-3">\u8BB0\u5F55\u65F6\u95F4</th>
                <th class="px-3 py-3">\u5907\u6CE8</th>
                <th class="px-3 py-3">\u64CD\u4F5C</th>
              </tr>
            </thead>
            <tbody>
              ${draft2.rolls.length ? draft2.rolls.map((roll, index) => {
      const planUnit = findSpreadingPlanUnitById(draft2.planUnits, roll.planUnitId);
      const garmentQtyPerUnit = planUnit?.garmentQtyPerUnit || 0;
      const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength);
      const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength);
      const actualCutGarmentQty = computeRollActualCutGarmentQty(roll.layerCount, garmentQtyPerUnit);
      return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">
                                <select class="h-8 w-52 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="planUnitId">
                                <option value="">\u8BF7\u9009\u62E9\u551B\u67B6\u9879</option>
                                ${(draft2.planUnits || []).map(
        (unit) => `<option value="${escapeHtml(unit.planUnitId)}" ${unit.planUnitId === (roll.planUnitId || "") ? "selected" : ""}>${escapeHtml(buildSpreadingPlanUnitLabel(unit))}</option>`
      ).join("")}
                              </select>
                            </td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(roll.rollNo)}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="rollNo" /></td>
                            <td class="px-3 py-3 text-muted-foreground">${renderMaterialIdentityBlock({
        materialSku: planUnit?.materialSku || roll.materialSku || "\u2014",
        materialLabel: planUnit?.materialSku || roll.materialSku || "\u2014",
        materialAlias: planUnit?.materialAlias || "",
        materialImageUrl: planUnit?.materialImageUrl || ""
      }, { compact: true })}</td>
                            <td class="px-3 py-3 text-muted-foreground">${escapeHtml(planUnit?.color || roll.color || "\u2014")}</td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.labeledLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="labeledLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.actualLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="actualLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.headLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="headLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.tailLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="tailLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.layerCount || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="layerCount" /></td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(usableLength), buildRollUsableLengthFormula(roll.actualLength, roll.headLength, roll.tailLength, usableLength), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(remainingLength), buildRemainingLengthFormula(roll.labeledLength, roll.actualLength, remainingLength), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(actualCutGarmentQty)} \u4EF6`, buildRollActualCutGarmentQtyFormula(actualCutGarmentQty, roll.layerCount, garmentQtyPerUnit), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(getSourceChannelDisplayLabel(roll.sourceChannel))}</td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(roll.occurredAt || "")}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="occurredAt" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(roll.note || "")}" class="h-8 w-40 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="note" /></td>
                            <td class="px-3 py-3">
                              <div class="flex flex-wrap gap-2">
                                <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="duplicate-roll" data-index="${index}">\u590D\u5236\u5377\u8BB0\u5F55</button>
                                <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-roll" data-index="${index}">\u5220\u9664\u5377\u8BB0\u5F55</button>
                              </div>
                            </td>
                          </tr>
                        `;
    }).join("") : '<tr><td colspan="16" class="px-3 py-6 text-center text-xs text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u5377\u8BB0\u5F55\uFF0C\u8BF7\u5148\u65B0\u589E\u5377\u8BB0\u5F55\u5E76\u7ED1\u5B9A\u551B\u67B6\u9879\u3002</td></tr>'}
            </tbody>
          </table>
        </div>
        ${renderSpreadingOutputMatrix(draft2.spreadingSessionId)}
      `
  );
  const renderOperatorsTab = () => renderSection(
    "\u6362\u73ED\u4E0E\u4EBA\u5458",
    `
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-operator">\u65B0\u589E\u4EBA\u5458\u8BB0\u5F55</button>
        </div>
        <details open class="rounded-md border bg-background" data-testid="cutting-spreading-edit-operators-fold" data-default-open="open">
          <summary class="cursor-pointer px-3 py-3 text-sm font-medium text-foreground">\u6362\u73ED\u660E\u7EC6\u6458\u8981</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-[1560px] text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">\u6240\u5C5E\u5377</th>
                <th class="px-3 py-3">\u64CD\u4F5C\u8D26\u53F7</th>
                <th class="px-3 py-3">\u64CD\u4F5C\u4EBA</th>
                <th class="px-3 py-3">\u52A8\u4F5C\u7C7B\u578B</th>
                <th class="px-3 py-3">\u5F00\u59CB\u5C42</th>
                <th class="px-3 py-3">\u7ED3\u675F\u5C42</th>
                <th class="px-3 py-3">\u8D1F\u8D23\u5C42\u6570\uFF08\u5C42\uFF09</th>
                <th class="px-3 py-3">\u8D1F\u8D23\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u8D1F\u8D23\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u63A5\u624B\u4EBA\u8D26\u53F7</th>
                <th class="px-3 py-3">\u8BB0\u5F55\u65F6\u95F4</th>
                <th class="px-3 py-3">\u5907\u6CE8</th>
                <th class="px-3 py-3">\u64CD\u4F5C</th>
              </tr>
            </thead>
            <tbody>
              ${draft2.operators.length ? draft2.operators.map((operator, index) => {
      const linkedRoll = draft2.rolls.find((roll) => roll.rollRecordId === operator.rollRecordId) || null;
      const linkedUnit = linkedRoll ? findSpreadingPlanUnitById(draft2.planUnits, linkedRoll.planUnitId) : null;
      const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer);
      const handledGarmentQty = computeOperatorHandledGarmentQty(handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0);
      const handledLength = computeOperatorHandledLengthByRoll(handledLayerCount, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0);
      return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">
                                <select class="h-8 w-44 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="rollRecordId">
                                <option value="">\u8BF7\u9009\u62E9\u5377</option>
                                ${draft2.rolls.map(
        (roll) => `<option value="${escapeHtml(roll.rollRecordId)}" ${roll.rollRecordId === (operator.rollRecordId || "") ? "selected" : ""}>${escapeHtml(roll.rollNo || "\u672A\u547D\u540D\u5377")}</option>`
      ).join("")}
                              </select>
                            </td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.operatorAccountId || "")}" class="h-8 w-32 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorAccountId" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.operatorName || "")}" class="h-8 w-28 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorName" /></td>
                            <td class="px-3 py-3">
                              <select class="h-8 w-32 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="actionType">
                                ${["\u5F00\u59CB\u94FA\u5E03", "\u4E2D\u9014\u4EA4\u63A5", "\u63A5\u624B\u7EE7\u7EED", "\u5B8C\u6210\u94FA\u5E03"].map((actionType) => `<option value="${escapeHtml(actionType)}" ${actionType === operator.actionType ? "selected" : ""}>${escapeHtml(actionType)}</option>`).join("")}
                              </select>
                            </td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(operator.startLayer === void 0 ? "" : String(operator.startLayer))}" class="h-8 w-20 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="startLayer" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(operator.endLayer === void 0 ? "" : String(operator.endLayer))}" class="h-8 w-20 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endLayer" /></td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLayerCount === null ? "\u5F85\u8865\u5F55" : `${formatQty(handledLayerCount)} \u5C42`, buildOperatorHandledLayerFormula(handledLayerCount, operator.startLayer, operator.endLayer), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledGarmentQty === null ? "\u5F85\u8865\u5F55" : `${formatQty(handledGarmentQty)} \u4EF6`, buildOperatorHandledGarmentQtyFormula(handledGarmentQty, handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLength === null ? "\u5F85\u8865\u5F55" : formatLength(handledLength), buildOperatorHandledLengthFormula(handledLength, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0, handledLayerCount), "text-sm text-foreground")}</td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.nextOperatorAccountId || "")}" class="h-8 w-32 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="nextOperatorAccountId" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.endAt || "")}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endAt" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.note || "")}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="note" /></td>
                            <td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-operator" data-index="${index}">\u5220\u9664</button></td>
                          </tr>
                        `;
    }).join("") : '<tr><td colspan="13" class="px-3 py-6 text-center text-xs text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u6362\u73ED\u4E0E\u4EBA\u5458\u8BB0\u5F55\u3002</td></tr>'}
            </tbody>
          </table>
          </div>
        </details>
        <div class="mt-2.5 space-y-2">
          ${Object.values(handoverSummaryByRollId).length ? Object.values(handoverSummaryByRollId).map(
      (summary) => `
                      <div class="rounded-lg border bg-muted/10 p-2.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="text-sm font-medium text-foreground">\u5377 ${escapeHtml(summary.rollNo || "\u5F85\u8865")}</div>
                          ${renderRollHandoverStatus(summary)}
                        </div>
                        <div class="mt-3">${renderRollHandoverWarnings(summary)}</div>
                      </div>
                    `
    ).join("") : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u5377\u7EA7\u6362\u73ED\u8BB0\u5F55\u3002</div>'}
        </div>
      `
  );
  const renderVarianceTab = () => renderSection(
    "\u5DEE\u5F02\u4E0E\u8865\u6599",
    `
        ${renderInfoGrid([
      {
        label: "\u9700\u6C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.plannedCutGarmentQtyFormula || `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} \u4EF6 = \u5F53\u524D\u9700\u6C42\u6210\u8863\u4EF6\u6570`
      },
      {
        label: "\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, [])
      },
      {
        label: "\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09",
        value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} \u4EF6`,
        formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0)
      },
      {
        label: "\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.claimedLengthTotal || 0),
        formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = \u03A3 \u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6`
      },
      {
        label: "\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.spreadActualLengthM || 0),
        formula: buildSumFormula(rollSummary.totalActualLength, draft2.rolls.map((roll) => roll.actualLength), 2)
      },
      {
        label: "\u5DEE\u5F02\u957F\u5EA6\uFF08m\uFF09",
        value: formatLength(varianceSummary?.varianceLength || 0),
        formula: varianceSummary?.varianceLengthFormula || buildDifferenceFormula(0, 0, 0, 2)
      }
    ])}
        <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <h4 class="text-sm font-semibold text-foreground">\u5DEE\u5F02\u5904\u7406\u9879</h4>
          <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(draft2.spreadingSessionId)}">\u53BB\u8865\u6599\u7BA1\u7406</button>
        </div>
        <details class="mt-2 rounded-md border bg-background" data-testid="cutting-spreading-edit-replenishment-fold" data-default-open="collapsed">
          <summary class="cursor-pointer px-3 py-3 text-sm font-medium text-foreground">\u5DEE\u5F02\u5904\u7406\u6458\u8981</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">\u88C1\u7247\u5355</th>
                <th class="px-3 py-3">\u9762\u6599</th>
                <th class="px-3 py-3">\u989C\u8272</th>
                <th class="px-3 py-3">\u9700\u6C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                <th class="px-3 py-3">\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\uFF08m\uFF09</th>
                <th class="px-3 py-3">\u9884\u8B66\u7B49\u7EA7</th>
                <th class="px-3 py-3">\u5EFA\u8BAE\u52A8\u4F5C</th>
                <th class="px-3 py-3">\u64CD\u4F5C</th>
              </tr>
            </thead>
            <tbody>
              ${replenishmentWarning.lines.length ? replenishmentWarning.lines.map((line) => {
      const warningLevel = line.shortageGarmentQty > 0 || line.actualLengthTotal > line.claimedLengthTotal ? "\u9AD8" : "\u4F4E";
      return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(line.cutOrderNo || line.cutOrderId)}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
        materialSku: line.materialSku,
        materialLabel: line.materialSku,
        materialAlias: line.materialAlias,
        materialImageUrl: line.materialImageUrl
      }, { compact: true })}</td>
                            <td class="px-3 py-3">${escapeHtml(line.color || "\u5F85\u8865")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.requiredGarmentQty)} \u4EF6`, `${formatQty(line.requiredGarmentQty)} \u4EF6 = \u5F53\u524D\u884C\u9700\u6C42\u6210\u8863\u4EF6\u6570`, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.actualCutGarmentQty)} \u4EF6`, line.actualCutGarmentQtyFormula, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.shortageGarmentQty)} \u4EF6`, line.shortageGarmentQtyFormula, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">${formatLength(line.claimedLengthTotal)}</td>
                            <td class="px-3 py-3">${formatLength(line.actualLengthTotal)}</td>
                            <td class="px-3 py-3">${renderStatusBadge(
        warningLevel,
        warningLevel === "\u9AD8" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
      )}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(line.suggestedAction, line.suggestedActionRuleText, "text-sm text-foreground")}</td>
                            <td class="px-3 py-3">
                              <button
                                type="button"
                                class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                                data-cutting-marker-action="launch-line-replenishment"
                                data-session-id="${escapeHtml(draft2.spreadingSessionId)}"
                                data-cut-order-id="${escapeHtml(line.cutOrderId)}"
                                data-cut-order-no="${escapeHtml(line.cutOrderNo)}"
                                data-material-sku="${escapeHtml(line.materialSku)}"
                                data-color="${escapeHtml(line.color || "")}"
                              >
                                \u53D1\u8D77\u8865\u6599
                              </button>
                            </td>
                          </tr>
                        `;
    }).join("") : '<tr><td colspan="11" class="px-3 py-6 text-center text-xs text-muted-foreground">\u5F53\u524D\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u5DEE\u5F02\u5904\u7406\u9879\u3002</td></tr>'}
            </tbody>
          </table>
          </div>
        </details>
      `
  );
  const content = state.spreadingEditTab === "rolls" ? renderRollsTab() : state.spreadingEditTab === "operators" ? renderOperatorsTab() : state.spreadingEditTab === "variance" ? renderVarianceTab() : renderSummaryTab();
  const headerActions = renderHeaderActions([
    '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list">\u8FD4\u56DE\u5217\u8868</button>',
    '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="save-spreading">\u4FDD\u5B58\u8349\u7A3F</button>',
    "",
    '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="complete-spreading">\u5B8C\u6210\u94FA\u5E03</button>'
  ]);
  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-edit-page">
      ${renderCuttingPageHeader(meta, { actionsHtml: headerActions })}
      ${renderFeedbackBar()}
      ${renderTopInfo()}
      ${renderSpreadingEditTabNav(state.spreadingEditTab)}
      ${content}
    </div>
  `;
}
function renderSpreadingCreateStepBar() {
  const steps = [
    { key: "SELECT_MARKER", label: "\u6B65\u9AA4 1\uFF1A\u9009\u62E9\u53EF\u94FA\u5E03\u551B\u67B6\u7F16\u53F7" },
    { key: "CONFIRM_CREATE", label: "\u6B65\u9AA4 2\uFF1A\u786E\u8BA4\u94FA\u5E03\u5355" }
  ];
  return `
    <section class="rounded-xl border bg-card p-3" data-testid="cutting-spreading-create-steps">
      <div class="flex flex-wrap gap-2">
        ${steps.map((step, index) => {
    const active = state.createStep === step.key;
    return `
              <div class="inline-flex items-center gap-2 rounded-md border px-3 py-3 text-sm ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border text-muted-foreground"}">
                <span class="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full ${active ? "bg-blue-600 text-white" : "bg-muted text-foreground"} text-[11px] font-semibold">${index + 1}</span>
                <span>${escapeHtml(step.label)}</span>
              </div>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderSpreadingCreateSourceTable(rows) {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">\u5F53\u524D\u6CA1\u6709\u53EF\u94FA\u5E03\u7684\u551B\u67B6\u7F16\u53F7\uFF0C\u8BF7\u5148\u56DE\u5230\u551B\u67B6\u65B9\u6848\u8865\u9F50\u53EF\u94FA\u5E03\u551B\u67B6\u7F16\u53F7\u3002</div>';
  }
  const schemeRows = Array.from(
    rows.reduce((accumulator, row) => {
      const key = row.sourceSchemeId || row.markerId;
      if (!accumulator.has(key)) accumulator.set(key, []);
      accumulator.get(key).push(row);
      return accumulator;
    }, /* @__PURE__ */ new Map()).values()
  ).map((items) => {
    const first = items[0];
    return {
      first,
      rows: items,
      totalQty: items.reduce((sum, item) => sum + Math.max(Number(item.plannedCutGarmentQty || 0), 0), 0),
      bedNos: items.map((item) => item.sourceBedNo).filter(Boolean)
    };
  });
  return `
    <div class="overflow-auto" data-testid="cutting-spreading-create-source-table">
      <table class="w-full min-w-[1080px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">\u9009\u4E2D</th>
            <th class="px-3 py-3">\u551B\u67B6\u65B9\u6848</th>
            <th class="px-3 py-3">\u751F\u4EA7\u5355 / \u88C1\u7247\u5355</th>
            <th class="px-3 py-3">\u6B3E\u5F0F / SPU</th>
            <th class="px-3 py-3">\u989C\u8272</th>
            <th class="px-3 py-3">\u551B\u67B6\u7F16\u53F7\u6570\u91CF</th>
            <th class="px-3 py-3">\u8BA1\u5212\u4EF6\u6570</th>
            <th class="px-3 py-3">\u53EF\u94FA\u5E03\u72B6\u6001</th>
          </tr>
        </thead>
        <tbody>
          ${schemeRows.map(({ first: row, rows: groupRows, totalQty, bedNos }) => {
    const selected = row.markerId === state.selectedCreateMarkerId || row.sourceBedId === state.selectedCreateMarkerId || row.sourceSchemeId === state.selectedCreateMarkerId;
    return `
                <tr class="border-b align-top ${selected ? "bg-blue-50/40" : ""}">
                  <td class="px-3 py-3">
                    <button
                      type="button"
                      class="rounded-md border px-3 py-1.5 text-xs ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "hover:bg-muted"}"
                      data-cutting-marker-action="select-spreading-create-marker"
                      data-marker-id="${escapeHtml(row.sourceSchemeId || row.markerId)}"
                    >
                      ${selected ? "\u5DF2\u9009\u4E2D" : "\u9009\u4E2D"}
                    </button>
                  </td>
                  <td class="px-3 py-3">
                    <div class="font-medium text-foreground">${escapeHtml(row.sourceSchemeNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(bedNos.slice(0, 4).join(" / ") || "\u5F85\u8865\u551B\u67B6\u7F16\u53F7")}${bedNos.length > 4 ? ` \u7B49 ${bedNos.length} \u4E2A` : ""}</div>
                  </td>
                  <td class="px-3 py-3">${escapeHtml(row.productionOrderNos.join(" / ") || row.cutOrderNos.join(" / ") || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(`${row.styleCode || "\u5F85\u8865"} / ${row.spuCode || "\u5F85\u8865"}`)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.colorSummary || "\u5F85\u8865")}</td>
                  <td class="px-3 py-3">${escapeHtml(`${formatQty(groupRows.length)} \u4E2A`)}</td>
                  <td class="px-3 py-3">${escapeHtml(`${formatQty(totalQty)} \u4EF6`)}</td>
                  <td class="px-3 py-3">${renderTag("\u53EF\u94FA\u5E03", "bg-emerald-100 text-emerald-700 border border-emerald-200")}</td>
                </tr>
              `;
  }).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function renderSpreadingCreateSelectStep(rows) {
  return renderSection(
    "\u6B65\u9AA4 1\uFF1A\u9009\u62E9\u53EF\u94FA\u5E03\u551B\u67B6\u7F16\u53F7",
    `
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          ${renderTextInput("\u641C\u7D22\u551B\u67B6\u7F16\u53F7", state.keyword, 'data-cutting-spreading-list-field="keyword"', "\u551B\u67B6\u65B9\u6848 / \u551B\u67B6\u7F16\u53F7 / \u751F\u4EA7\u5355 / \u6B3E\u53F7 / \u989C\u8272")}
          <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-cutting-marker-action="clear-filters">\u91CD\u7F6E</button>
        </div>
      `)}
      <div class="mt-3">
        ${renderSpreadingCreateSourceTable(rows)}
      </div>
    `
  );
}
function renderSpreadingCreateConfirmStep() {
  const selectedSchemeRows = getSelectedCreateSchemeSources();
  const totalQty = selectedSchemeRows.reduce((sum, row) => sum + Math.max(Number(row.plannedCutGarmentQty || 0), 0), 0);
  return renderSection(
    "\u6B65\u9AA4 2\uFF1A\u786E\u8BA4\u94FA\u5E03\u5355",
    `
        <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-foreground">
        \u5C06\u6309\u5DF2\u9009\u551B\u67B6\u65B9\u6848\u7684 ${formatQty(selectedSchemeRows.length)} \u4E2A\u551B\u67B6\u7F16\u53F7\u751F\u6210 ${formatQty(selectedSchemeRows.length)} \u5F20\u5F85\u94FA\u5E03\u5355\u3002
      </div>
      <div class="mt-3 overflow-auto rounded-lg border">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-3">\u9884\u8BA1\u94FA\u5E03\u5355</th>
              <th class="px-3 py-3">\u551B\u67B6\u65B9\u6848</th>
              <th class="px-3 py-3">\u551B\u67B6\u7F16\u53F7</th>
              <th class="px-3 py-3">\u72B6\u6001</th>
              <th class="px-3 py-3">\u8BA1\u5212\u6570\u91CF</th>
            </tr>
          </thead>
          <tbody>
            ${selectedSchemeRows.map((row, index) => {
      return `
                  <tr class="border-b align-top">
                    <td class="px-3 py-3 font-medium text-foreground">\u94FA\u5E03\u5355 ${index + 1}</td>
                    <td class="px-3 py-3">${escapeHtml(row.sourceSchemeNo || "\u5F85\u8865")}</td>
                    <td class="px-3 py-3">${escapeHtml(row.sourceBedNo || row.markerNo || "\u5F85\u8865")}</td>
                    <td class="px-3 py-3">${renderTag("\u5F85\u94FA\u5E03", "bg-slate-100 text-slate-700 border border-slate-200")}</td>
                    <td class="px-3 py-3">${escapeHtml(`${formatQty(row.plannedCutGarmentQty)} \u4EF6`)}</td>
                  </tr>
                `;
    }).join("")}
          </tbody>
          <tfoot class="bg-muted/20 text-sm font-medium">
            <tr>
              <td class="px-3 py-3" colspan="4">\u5408\u8BA1</td>
              <td class="px-3 py-3">${escapeHtml(`${formatQty(totalQty)} \u4EF6`)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
  );
}
function renderSpreadingCreatePage() {
  const meta = getCanonicalCuttingMeta(getCurrentPathname(), "spreading-create");
  const createRows = getSpreadingCreateSourceRows();
  const selectedSource = getSelectedCreateSource(createRows);
  const canProceed = Boolean(selectedSource) || state.createExceptionBackfill;
  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-create-page">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: renderHeaderActions([
      '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list">\u8FD4\u56DE\u5217\u8868</button>'
    ])
  })}
      ${renderFeedbackBar()}
      ${renderSpreadingCreateStepBar()}
      ${state.createStep === "SELECT_MARKER" ? renderSpreadingCreateSelectStep(createRows) : renderSpreadingCreateConfirmStep()}
      <section class="rounded-xl border bg-card p-4">
        <div class="flex flex-wrap justify-end gap-2">
          ${state.createStep !== "SELECT_MARKER" ? '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="prev-spreading-create-step">\u4E0A\u4E00\u6B65</button>' : ""}
          ${state.createStep === "SELECT_MARKER" ? `<button type="button" class="rounded-md bg-blue-600 px-3 py-3 text-sm text-white ${canProceed ? "hover:bg-blue-700" : "cursor-not-allowed opacity-50"}" data-cutting-marker-action="next-spreading-create-step" ${canProceed ? "" : "disabled"}>\u4E0B\u4E00\u6B65</button>` : '<button type="button" class="rounded-md bg-blue-600 px-3 py-3 text-sm text-white hover:bg-blue-700" data-cutting-marker-action="confirm-spreading-create">\u786E\u8BA4\u751F\u6210\u94FA\u5E03\u5355</button>'}
        </div>
      </section>
    </div>
  `;
}
function renderPage() {
  syncStateFromPath();
  const pathname = getCurrentPathname();
  if (pathname === getCanonicalCuttingPath("spreading-detail")) return renderSpreadingDetailPage();
  if (pathname === getCanonicalCuttingPath("spreading-edit")) return renderSpreadingEditPage();
  if (pathname === getCanonicalCuttingPath("spreading-create")) return renderSpreadingCreatePage();
  return renderSpreadingSupervisorListPage();
}
function buildListRoute() {
  return buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-list"), {
    cutOrderId: state.prefilter?.cutOrderId,
    cutOrderNo: state.prefilter?.cutOrderNo,
    markerPlanId: state.prefilter?.markerPlanId,
    markerPlanNo: state.prefilter?.markerPlanNo,
    productionOrderNo: state.prefilter?.productionOrderNo,
    styleCode: state.prefilter?.styleCode,
    materialSku: state.prefilter?.materialSku
  });
}
function persistImportedDraftAndOpen(draft2, successMessage) {
  const data = readMarkerSpreadingPrototypeData();
  const nextStore = upsertSpreadingSession(draft2, data.store);
  persistMarkerSpreadingStore(nextStore);
  state.feedback = { tone: "success", message: successMessage };
  state.importDecision = null;
  const saved = nextStore.sessions.find((item) => item.spreadingSessionId === draft2.spreadingSessionId) || draft2;
  appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-edit"), buildContextPayloadFromSession(saved)));
  return true;
}
function startMarkerImport(marker) {
  const validation = validateMarkerForSpreadingImport(marker);
  if (!validation.allowed) {
    state.feedback = { tone: "warning", message: validation.messages.join("\uFF1B") };
    state.importDecision = null;
    return true;
  }
  const data = readMarkerSpreadingPrototypeData();
  const relatedSessions = data.store.sessions.filter((session) => session.markerId === marker.markerId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));
  const latestSession = relatedSessions[0] || null;
  if (!latestSession) {
    const newDraft = createImportedSpreadingDraft(marker, {
      importNote: "\u9996\u6B21\u4ECE\u551B\u67B6\u5BFC\u5165\u94FA\u5E03\u8349\u7A3F\u3002"
    });
    if (!newDraft) {
      state.feedback = { tone: "warning", message: "\u5F53\u524D\u551B\u67B6\u7F16\u53F7\u4E0A\u4E0B\u6587\u4E0D\u5B8C\u6574\uFF0C\u65E0\u6CD5\u751F\u6210\u94FA\u5E03\u8349\u7A3F\u3002" };
      return true;
    }
    return persistImportedDraftAndOpen(newDraft, `${marker.markerNo || "\u5F53\u524D\u551B\u67B6\u7F16\u53F7"} \u5DF2\u751F\u6210\u94FA\u5E03\u8349\u7A3F\u3002`);
  }
  if (!hasSpreadingActualExecution(latestSession)) {
    const syncedDraft = syncImportedFieldsToExistingSession(marker, latestSession);
    if (!syncedDraft) {
      state.feedback = { tone: "warning", message: "\u5F53\u524D\u94FA\u5E03\u8349\u7A3F\u65E0\u6CD5\u540C\u6B65\u551B\u67B6\u7406\u8BBA\u5B57\u6BB5\uFF0C\u8BF7\u68C0\u67E5\u4E0A\u4E0B\u6587\u3002" };
      return true;
    }
    return persistImportedDraftAndOpen(syncedDraft, `${latestSession.sessionNo || "\u5F53\u524D\u94FA\u5E03\u8349\u7A3F"} \u5DF2\u6309\u6700\u65B0\u551B\u67B6\u6A21\u677F\u540C\u6B65\u3002`);
  }
  state.importDecision = {
    markerId: marker.markerId,
    markerNo: marker.markerNo || marker.markerId,
    targetSessionId: latestSession.spreadingSessionId,
    targetSessionNo: latestSession.sessionNo || latestSession.spreadingSessionId
  };
  state.feedback = { tone: "warning", message: "\u68C0\u6D4B\u5230\u5DF2\u6709\u5B9E\u9645\u5377\u8BB0\u5F55\u6216\u4EBA\u5458\u8BB0\u5F55\uFF0C\u4E0D\u80FD\u76F4\u63A5\u8986\u76D6\uFF0C\u8BF7\u5148\u9009\u62E9\u518D\u6B21\u5BFC\u5165\u7B56\u7565\u3002" };
  return true;
}
function navigateToMarkerPage(target, markerId) {
  if (!markerId) return false;
  const row = getMarkerRow(markerId);
  if (!row) return false;
  const path = target === "detail" ? `${getCanonicalCuttingPath("marker-detail")}/${encodeURIComponent(row.markerId)}` : `${getCanonicalCuttingPath("marker-edit")}/${encodeURIComponent(row.markerId)}`;
  appStore.navigate(buildMarkerRouteWithContext(path, buildContextPayloadFromMarker(row.record)));
  return true;
}
function navigateToSpreadingPage(target, sessionId) {
  if (!sessionId) return false;
  const row = getSpreadingRow(sessionId);
  if (!row) return false;
  const path = target === "detail" ? getCanonicalCuttingPath("spreading-detail") : getCanonicalCuttingPath("spreading-edit");
  appStore.navigate(buildMarkerRouteWithContext(path, buildContextPayloadFromSession(row.session)));
  return true;
}
function navigateFromSpreadingSession(sessionId, target) {
  if (!sessionId) return false;
  const row = getSpreadingRow(sessionId);
  if (!row) return false;
  const context = buildCuttingDrillContext(
    target === "cut-orders" ? buildContextPayloadFromSession(row.session) : {
      markerPlanId: row.session.markerPlanId || void 0,
      markerPlanNo: row.session.markerPlanNo || void 0,
      cutOrderNo: row.cutOrderNos[0] || void 0,
      productionOrderNo: row.productionOrderNos[0] || void 0
    },
    "spreading-list",
    {
      productionOrderNo: row.productionOrderNos[0] || void 0,
      cutOrderNo: row.cutOrderNos[0] || void 0,
      markerPlanId: row.session.markerPlanId || void 0,
      markerPlanNo: row.session.markerPlanNo || void 0,
      materialSku: row.materialSkuSummary?.split(" / ")[0] || void 0,
      autoOpenDetail: true
    }
  );
  appStore.navigate(buildCuttingRouteWithContext(target === "cut-orders" ? "cutOrders" : "markerPlanRefs", context));
  return true;
}
function saveCurrentMarker(goDetail, successMessage) {
  const draft2 = state.markerDraft;
  if (!draft2) return false;
  const templateType = deriveMarkerTemplateByMode(draft2.markerMode);
  const data = readMarkerSpreadingPrototypeData();
  const sourceRows = buildMarkerAllocationSourceRows(draft2, data.rowsById);
  const sourceRowsById = Object.fromEntries(sourceRows.map((row) => [row.cutOrderId, row]));
  const normalizedLineItems = (draft2.lineItems || []).map((item, index) => ({
    ...item,
    markerId: draft2.markerId,
    lineNo: item.lineNo || index + 1,
    layoutCode: item.layoutCode || `A-${index + 1}`,
    layoutDetailText: item.layoutDetailText || item.ratioLabel || "",
    spreadRepeatCount: Number(item.spreadRepeatCount || 0),
    markerPieceCount: item.markerPieceCount ?? item.pieceCount ?? 0,
    pieceCount: item.markerPieceCount ?? item.pieceCount ?? 0,
    singlePieceUsage: item.singlePieceUsage || computeSinglePieceUsage(Number(item.markerLength || 0), Number(item.markerPieceCount ?? item.pieceCount ?? 0)),
    spreadTotalLength: Number(((Number(item.markerLength || 0) + 0.06) * Math.max(Number(item.spreadRepeatCount || 0), 0)).toFixed(2)),
    spreadingTotalLength: Number(((Number(item.markerLength || 0) + 0.06) * Math.max(Number(item.spreadRepeatCount || 0), 0)).toFixed(2))
  }));
  const totalPieces = computeMarkerTotalPieces(draft2.sizeDistribution);
  const normalizedHighLowCuttingRows = (draft2.highLowCuttingRows || []).map((row) => ({
    ...row,
    markerId: draft2.markerId,
    total: MARKER_SIZE_KEYS.reduce((sum, sizeKey) => sum + Math.max(row.sizeValues[sizeKey] || 0, 0), 0)
  }));
  const patternKeys = draft2.highLowPatternKeys?.length ? draft2.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS];
  const normalizedHighLowPatternRows = (draft2.highLowPatternRows || []).map((row) => ({
    ...row,
    markerId: draft2.markerId,
    patternValues: Object.fromEntries(patternKeys.map((key) => [key, Number(row.patternValues[key] || 0)])),
    total: patternKeys.reduce((sum, key) => sum + Math.max(row.patternValues[key] || 0, 0), 0)
  }));
  const spreadTotalLength = templateType === "row-template" ? computeNormalMarkerSpreadTotalLength(normalizedLineItems) : Number(draft2.spreadTotalLength || draft2.actualMaterialMeter || 0);
  const normalizedAllocationLines = (draft2.allocationLines || []).map((line, index) => {
    const sourceRow = sourceRowsById[line.sourceCutOrderId] || null;
    return applyAllocationSourceRowToLine(
      {
        ...line,
        allocationId: line.allocationId || `marker-allocation-${Date.now()}-${index}`,
        markerId: draft2.markerId,
        plannedGarmentQty: Number(line.plannedGarmentQty || 0)
      },
      sourceRow ? {
        sourceCutOrderId: sourceRow.cutOrderId,
        sourceCutOrderNo: sourceRow.cutOrderNo,
        sourceProductionOrderId: sourceRow.productionOrderId,
        sourceProductionOrderNo: sourceRow.productionOrderNo,
        styleCode: sourceRow.styleCode,
        spuCode: sourceRow.spuCode,
        techPackSpuCode: sourceRow.techPackSpuCode || "",
        color: sourceRow.color,
        materialSku: sourceRow.materialSkuSummary,
        allocationSummaryText: "",
        allocationTotalQty: 0
      } : null,
      draft2
    );
  });
  const sizeTotals = /* @__PURE__ */ new Map();
  normalizedAllocationLines.forEach((line) => {
    sizeTotals.set(line.sizeLabel, (sizeTotals.get(line.sizeLabel) || 0) + Math.max(line.plannedGarmentQty || 0, 0));
  });
  const blockingMessages = [];
  if (draft2.cutOrderIds.length > 0 && !normalizedAllocationLines.length) {
    blockingMessages.push("\u5F53\u524D\u551B\u67B6\u7F16\u53F7\u5DF2\u5173\u8054\u88C1\u7247\u5355\uFF0C\u8BF7\u5148\u8865\u5145\u5206\u914D\u660E\u7EC6\u3002");
  }
  normalizedAllocationLines.forEach((line) => {
    if (!draft2.cutOrderIds.includes(line.sourceCutOrderId)) {
      blockingMessages.push(`\u5206\u914D\u884C ${line.sourceCutOrderNo || line.allocationId} \u4E0D\u5C5E\u4E8E\u5F53\u524D\u5173\u8054\u88C1\u7247\u5355\u3002`);
    }
    if (Number(line.plannedGarmentQty || 0) < 0) {
      blockingMessages.push(`\u5206\u914D\u884C ${line.sourceCutOrderNo || line.allocationId} \u7684\u8BA1\u5212\u6210\u8863\u6570\u4E0D\u80FD\u5C0F\u4E8E 0\u3002`);
    }
  });
  draft2.sizeDistribution.forEach((item) => {
    if (item.quantity > 0 && (sizeTotals.get(item.sizeLabel) || 0) !== item.quantity) {
      blockingMessages.push(`\u5C3A\u7801 ${item.sizeLabel} \u5C1A\u672A\u914D\u5E73\uFF1A\u914D\u6BD4 ${item.quantity}\uFF0C\u5206\u914D ${sizeTotals.get(item.sizeLabel) || 0}\u3002`);
    }
  });
  if (blockingMessages.length) {
    state.feedback = { tone: "warning", message: Array.from(new Set(blockingMessages)).join("\uFF1B") };
    return true;
  }
  const pieceExplosion = buildMarkerPieceExplosionViewModel({
    marker: {
      ...draft2,
      allocationLines: normalizedAllocationLines
    },
    sourceRows
  });
  const warningMessages = buildMarkerWarningMessages({
    ...draft2,
    totalPieces,
    spreadTotalLength,
    allocationLines: normalizedAllocationLines,
    lineItems: templateType === "row-template" ? normalizedLineItems : [],
    highLowPatternKeys: templateType === "matrix-template" ? patternKeys : [],
    highLowCuttingRows: templateType === "matrix-template" ? normalizedHighLowCuttingRows : [],
    highLowPatternRows: templateType === "matrix-template" ? normalizedHighLowPatternRows : []
  });
  const mergedWarnings = Array.from(/* @__PURE__ */ new Set([...warningMessages, ...pieceExplosion.mappingWarnings]));
  const nextStore = upsertMarkerRecord(
    {
      ...draft2,
      cutOrderNos: draft2.cutOrderNos || data.rows.filter((row) => draft2.cutOrderIds.includes(row.cutOrderId)).map((row) => row.cutOrderNo),
      techPackSpuCode: (Array.from(new Set(sourceRows.map((row) => row.techPackSpuCode).filter(Boolean))).length === 1 ? Array.from(new Set(sourceRows.map((row) => row.techPackSpuCode).filter(Boolean)))[0] : "") || draft2.techPackSpuCode || "",
      totalPieces,
      singlePieceUsage: draft2.singlePieceUsage || computeSinglePieceUsage(draft2.netLength, totalPieces),
      sizeRatioPlanText: draft2.sizeRatioPlanText || draft2.sizeDistribution.filter((item) => item.quantity > 0).map((item) => `${item.sizeLabel}\xD7${item.quantity}`).join(" / "),
      spreadTotalLength,
      allocationLines: normalizedAllocationLines,
      lineItems: templateType === "row-template" ? normalizedLineItems : [],
      highLowPatternKeys: templateType === "matrix-template" ? patternKeys : [],
      highLowCuttingRows: templateType === "matrix-template" ? normalizedHighLowCuttingRows : [],
      highLowPatternRows: templateType === "matrix-template" ? normalizedHighLowPatternRows : [],
      warningMessages: mergedWarnings
    },
    data.store
  );
  persistMarkerSpreadingStore(nextStore);
  const saved = nextStore.markers.find((item) => item.markerId === draft2.markerId) || draft2;
  state.markerDraft = ensureMarkerDraftShape(cloneMarkerRecord(saved));
  state.feedback = { tone: "success", message: successMessage || `${saved.markerNo || "\u8BA1\u5212\u8BB0\u5F55"} \u5DF2\u4FDD\u5B58\u3002` };
  if (goDetail) {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("marker-detail"), buildContextPayloadFromMarker(saved)));
  }
  return true;
}
function createOperatorDraftForRoll(session, rollRecordId) {
  const linkedOperators = session.operators.filter((operator) => operator.rollRecordId === rollRecordId).sort((left, right) => {
    const startGap = (left.sortOrder || 0) - (right.sortOrder || 0);
    if (startGap !== 0) return startGap;
    return left.startAt.localeCompare(right.startAt, "zh-CN");
  });
  const previousOperator = linkedOperators[linkedOperators.length - 1] || null;
  const nextDraft = {
    ...createOperatorRecordDraft(session.spreadingSessionId),
    sortOrder: session.operators.length + 1,
    rollRecordId,
    unitPrice: session.unitPrice,
    pricingMode: "\u6309\u4EF6\u8BA1\u4EF7"
  };
  if (!previousOperator) {
    return nextDraft;
  }
  return {
    ...nextDraft,
    actionType: "\u63A5\u624B\u7EE7\u7EED",
    previousOperatorName: previousOperator.operatorName || "",
    startLayer: previousOperator.endLayer !== void 0 ? Number(previousOperator.endLayer) + 1 : void 0,
    handoverAtLayer: previousOperator.endLayer,
    handoverAtLength: previousOperator.handledLength,
    handoverNotes: ""
  };
}
function cloneRollRecordForDraft(roll, session, nextIndex) {
  const nextRoll = createRollRecordDraft(
    session.spreadingSessionId,
    roll.materialSku || session.materialSkuSummary?.split(" / ")[0] || "",
    roll.planUnitId || session.planUnits?.[0]?.planUnitId || ""
  );
  return {
    ...nextRoll,
    sortOrder: nextIndex + 1,
    planUnitId: roll.planUnitId || nextRoll.planUnitId,
    materialSku: roll.materialSku || nextRoll.materialSku,
    color: roll.color || "",
    labeledLength: roll.labeledLength,
    actualLength: roll.actualLength,
    headLength: roll.headLength,
    tailLength: roll.tailLength,
    layerCount: roll.layerCount,
    width: roll.width,
    note: roll.note
  };
}
function syncDraftRollFromPlanUnit(draft2, roll) {
  const linkedPlanUnit = findSpreadingPlanUnitById(draft2.planUnits, roll.planUnitId);
  if (linkedPlanUnit) {
    roll.planUnitId = linkedPlanUnit.planUnitId;
    roll.materialSku = linkedPlanUnit.materialSku;
    roll.color = linkedPlanUnit.color;
  }
  const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || 0;
  roll.actualCutPieceQty = computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit);
}
function syncSpreadingDraftFromStoredPdaWriteback(draft2) {
  const stored = getStoredSpreadingSession(draft2.spreadingSessionId);
  if (!stored) {
    state.feedback = { tone: "warning", message: "\u5F53\u524D\u94FA\u5E03\u8FD8\u6CA1\u6709\u53EF\u540C\u6B65\u7684\u5DE5\u5382\u7AEF\u56DE\u5199\u8BB0\u5F55\u3002" };
    return true;
  }
  const hasPdaSource = stored.rolls.some((roll) => isMobileWritebackSource(roll.sourceChannel, roll.sourceWritebackId)) || stored.operators.some((operator) => isMobileWritebackSource(operator.sourceChannel, operator.sourceWritebackId));
  if (!hasPdaSource) {
    state.feedback = { tone: "warning", message: "\u5F53\u524D\u94FA\u5E03\u8FD8\u6CA1\u6709\u6765\u81EA\u5DE5\u5382\u7AEF\u7684\u5377\u6216\u4EBA\u5458\u56DE\u5199\u3002" };
    return true;
  }
  state.spreadingDraft = cloneSpreadingSession(stored);
  state.feedback = { tone: "success", message: "\u5DF2\u540C\u6B65\u5F53\u524D\u94FA\u5E03\u7684\u5DE5\u5382\u7AEF\u5377\u8BB0\u5F55\u4E0E\u6362\u73ED\u8BB0\u5F55\u3002" };
  return true;
}
function buildPersistableSpreadingDraft(draft2) {
  const normalizeOptionalNumber = (value) => {
    if (value === void 0 || value === null || value === "") return void 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : void 0;
  };
  const derived = resolveSpreadingDerivedState(draft2);
  const markerTotalPieces = derived.markerTotalPieces;
  const normalizedRolls = draft2.rolls.map((roll, index) => {
    const actualLength = Number(roll.actualLength || 0);
    const headLength = Number(roll.headLength || 0);
    const tailLength = Number(roll.tailLength || 0);
    const labeledLength = Number(roll.labeledLength || 0);
    const linkedPlanUnit = findSpreadingPlanUnitById(draft2.planUnits, roll.planUnitId);
    const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || markerTotalPieces;
    const usableLength = computeUsableLength(actualLength, headLength, tailLength);
    const remainingLength = computeRemainingLength(labeledLength, actualLength);
    const actualCutPieceQty2 = computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit);
    const operatorNames = draft2.operators.filter((operator) => operator.rollRecordId === roll.rollRecordId).map((operator) => operator.operatorName).filter(Boolean);
    return {
      ...roll,
      planUnitId: roll.planUnitId || linkedPlanUnit?.planUnitId || "",
      materialSku: linkedPlanUnit?.materialSku || roll.materialSku,
      color: linkedPlanUnit?.color || roll.color,
      sortOrder: index + 1,
      totalLength: Number((actualLength + headLength + tailLength).toFixed(2)),
      remainingLength,
      usableLength,
      actualCutPieceQty: actualCutPieceQty2,
      operatorNames
    };
  });
  const actualCutPieceQty = normalizedRolls.reduce((sum, roll) => sum + Math.max(roll.actualCutPieceQty || 0, 0), 0);
  const baseOperators = draft2.operators.map((operator, index) => ({
    ...operator,
    sortOrder: index + 1,
    startLayer: normalizeOptionalNumber(operator.startLayer),
    endLayer: normalizeOptionalNumber(operator.endLayer),
    handledLength: normalizeOptionalNumber(operator.handledLength),
    pricingMode: operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
    unitPrice: normalizeOptionalNumber(operator.unitPrice) ?? normalizeOptionalNumber(draft2.unitPrice),
    manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
    adjustedAmount: normalizeOptionalNumber(operator.adjustedAmount),
    amountNote: operator.amountNote || "",
    nextOperatorAccountId: operator.nextOperatorAccountId || "",
    handoverFlag: operator.handoverFlag || operator.actionType === "\u4E2D\u9014\u4EA4\u63A5" || operator.actionType === "\u63A5\u624B\u7EE7\u7EED" || Boolean(operator.handoverNotes)
  }));
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
        pricingMode: item.operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
        unitPrice: item.operator.unitPrice ?? normalizeOptionalNumber(draft2.unitPrice) ?? void 0,
        calculatedAmount: computeOperatorCalculatedAmount({
          pricingMode: item.operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
          unitPrice: item.operator.unitPrice ?? normalizeOptionalNumber(draft2.unitPrice),
          handledLayerCount: item.handledLayerCount,
          handledLength: item.operator.handledLength,
          handledPieceQty: item.handledPieceQty
        }) ?? void 0,
        manualAmountAdjusted: Boolean(item.operator.manualAmountAdjusted),
        adjustedAmount: item.operator.adjustedAmount ?? void 0,
        amountNote: item.operator.amountNote || "",
        nextOperatorAccountId: item.operator.nextOperatorAccountId || "",
        previousOperatorName: item.previousOperatorName || "",
        nextOperatorName: item.nextOperatorName || "",
        handoverAtLayer: item.handoverAtLayer ?? void 0,
        handoverAtLength: item.handoverAtLength ?? void 0
      });
    });
  });
  const normalizedOperators = baseOperators.map((operator) => quantifiedOperatorsById.get(operator.operatorRecordId) || operator);
  const rollSummary = summarizeSpreadingRolls(normalizedRolls);
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(normalizedOperators, markerTotalPieces, draft2.unitPrice);
  const data = readMarkerSpreadingPrototypeData();
  const primaryRows = draft2.cutOrderIds.map((id) => data.rowsById[id]).filter((row) => Boolean(row));
  const colorSummaryDerived = deriveSpreadingColorSummary({
    rolls: normalizedRolls,
    importSourceColorSummary: draft2.importSource?.sourceColorSummary,
    contextColors: primaryRows.map((row) => row.color),
    fallbackSummary: draft2.colorSummary
  });
  const varianceContext = primaryRows.length ? {
    contextType: draft2.contextType,
    cutOrderIds: [...draft2.cutOrderIds],
    cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
    markerPlanId: draft2.markerPlanId,
    markerPlanNo: draft2.markerPlanNo,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    styleCode: draft2.styleCode || primaryRows[0].styleCode,
    spuCode: draft2.spuCode || primaryRows[0].spuCode,
    styleName: primaryRows[0].styleName,
    materialSkuSummary: draft2.materialSkuSummary || primaryRows[0].materialSkuSummary,
    materialAliasSummary: Array.from(new Set(primaryRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias)).filter(Boolean))).join(" / "),
    materialImageUrl: primaryRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || "",
    materialPrepRows: primaryRows
  } : null;
  const varianceSummary = buildSpreadingVarianceSummary(
    varianceContext,
    derived.markerRecord,
    {
      ...draft2,
      rolls: normalizedRolls,
      operators: normalizedOperators,
      actualCutPieceQty
    }
  );
  const warningMessages = buildSpreadingWarningMessages({
    session: {
      ...draft2,
      rolls: normalizedRolls,
      operators: normalizedOperators
    },
    markerTotalPieces,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0
  });
  const selectedTable = draft2.cuttingTableId ? resolveCuttingTable(draft2.cuttingTableId) : null;
  const plannedStartAt = draft2.plannedStartAt || "";
  const plannedEndAt = draft2.plannedEndAt || (plannedStartAt ? addMinutesToDateTimeLocal(plannedStartAt, draft2.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES) : "");
  const normalizedDraft = {
    ...draft2,
    cuttingTableId: selectedTable?.cuttingTableId || "",
    cuttingTableNo: selectedTable?.cuttingTableNo || "",
    cuttingTableName: selectedTable?.cuttingTableName || "",
    plannedStartAt,
    plannedEndAt,
    estimatedDurationMinutes: draft2.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
    tableScheduleStatus: plannedStartAt && selectedTable ? draft2.tableScheduleStatus || "\u5DF2\u6392\u7A0B" : draft2.tableScheduleStatus || "\u672A\u6392\u7A0B",
    colorSummary: colorSummaryDerived.value === "\u5F85\u8865" ? "" : colorSummaryDerived.value,
    rolls: normalizedRolls,
    operators: normalizedOperators,
    actualCutPieceQty,
    totalActualLength: rollSummary.totalActualLength,
    totalHeadLength: rollSummary.totalHeadLength,
    totalTailLength: rollSummary.totalTailLength,
    totalCalculatedUsableLength: rollSummary.totalCalculatedUsableLength,
    totalRemainingLength: rollSummary.totalRemainingLength,
    rollCount: normalizedRolls.length,
    operatorCount: normalizedOperators.length,
    actualLayers: rollSummary.totalLayers,
    configuredLengthTotal: varianceSummary?.configuredLengthTotal || 0,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
    varianceLength: varianceSummary?.varianceLength || 0,
    varianceNote: varianceSummary?.replenishmentHint || "\u5F53\u524D\u5C1A\u672A\u8BC6\u522B\u660E\u663E\u5DEE\u5F02\u3002",
    warningMessages,
    importSource: draft2.importSource || null,
    planLineItems: draft2.planLineItems || [],
    highLowPlanSnapshot: draft2.highLowPlanSnapshot || null,
    theoreticalSpreadTotalLength: derived.markerRecord?.spreadTotalLength ?? draft2.theoreticalSpreadTotalLength ?? 0,
    theoreticalActualCutPieceQty: computeSessionPlannedCutGarmentQty(draft2, markerTotalPieces),
    importAdjustmentRequired: Boolean(draft2.importAdjustmentRequired),
    importAdjustmentNote: draft2.importAdjustmentNote || "",
    totalAmount: operatorAmountSummary.hasAnyAllocationData ? operatorAmountSummary.totalDisplayAmount : Number(((draft2.unitPrice || 0) * actualCutPieceQty).toFixed(2))
  };
  return {
    normalizedDraft,
    derived: resolveSpreadingDerivedState(normalizedDraft),
    primaryRows
  };
}
function buildCreateSessionsFromSelection() {
  const preview = getSpreadingCreatePreview();
  if (state.createExceptionBackfill) {
    state.feedback = { tone: "warning", message: "\u94FA\u5E03\u5FC5\u987B\u9009\u62E9\u4E00\u4E2A\u53EF\u6267\u884C\u7684\u551B\u67B6\u7F16\u53F7\u3002" };
    return null;
  }
  if (!preview.source || !preview.source.markerId) {
    state.feedback = { tone: "warning", message: "\u521B\u5EFA\u94FA\u5E03\u9700\u5148\u9009\u4E2D\u4E00\u4E2A\u53EF\u94FA\u5E03\u7684\u551B\u67B6\u7F16\u53F7\u3002" };
    return null;
  }
  const selectedRows = getSelectedCreateSchemeSources();
  if (!selectedRows.length) {
    state.feedback = { tone: "warning", message: "\u5F53\u524D\u551B\u67B6\u65B9\u6848\u6CA1\u6709\u53EF\u751F\u6210\u94FA\u5E03\u4EFB\u52A1\u7684\u551B\u67B6\u7F16\u53F7\u3002" };
    return null;
  }
  const scheduleBatchId = `spreading-create-batch-${Date.now()}`;
  const drafts = [];
  for (let rowIndex = 0; rowIndex < selectedRows.length; rowIndex += 1) {
    const source = selectedRows[rowIndex];
    if (!source.spreadingContext || !source.markerRecord) {
      state.feedback = { tone: "warning", message: `\u551B\u67B6\u7F16\u53F7 ${source.sourceBedNo || source.markerNo} \u672A\u8BC6\u522B\u5230\u4E0A\u4E0B\u6587\uFF0C\u65E0\u6CD5\u521B\u5EFA\u94FA\u5E03\u3002` };
      return null;
    }
    const identity = buildSpreadingSessionIdentityForMarkerBed(source, rowIndex);
    const draft2 = createSpreadingDraftFromMarker(
      source.markerRecord,
      source.spreadingContext,
      new Date(Date.now() + rowIndex),
      {
        baseSession: {
          spreadingSessionId: identity.spreadingSessionId,
          sessionNo: identity.sessionNo,
          note: state.createNote || "\u94FA\u5E03\u5355\u5DF2\u521B\u5EFA\uFF0C\u5F85\u94FA\u5E03\u3002",
          ownerAccountId: "",
          ownerName: "",
          isExceptionBackfill: false,
          exceptionReason: ""
        }
      }
    );
    const bedNo = source.sourceBedNo || source.markerNo || draft2.sourceBedNo || draft2.markerNo || "";
    const bedId = source.sourceBedId || source.markerId || draft2.sourceBedId || draft2.sourceMarkerId || "";
    draft2.status = "DRAFT";
    draft2.cuttingStatus = void 0;
    draft2.ownerAccountId = "";
    draft2.ownerName = "";
    draft2.note = state.createNote || draft2.note;
    draft2.cuttingTableId = "";
    draft2.cuttingTableNo = "";
    draft2.cuttingTableName = "";
    draft2.plannedStartAt = "";
    draft2.plannedEndAt = "";
    draft2.actualStartAt = "";
    draft2.actualEndAt = "";
    draft2.estimatedDurationMinutes = DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES;
    draft2.tableScheduleStatus = "\u672A\u6392\u7A0B";
    draft2.scheduleMode = "BY_MARKER_NO";
    draft2.scheduleBatchId = scheduleBatchId;
    draft2.sequenceNoInScheme = rowIndex + 1;
    draft2.sourceSchemeId = source.sourceSchemeId || draft2.sourceSchemeId;
    draft2.sourceSchemeNo = source.sourceSchemeNo || draft2.sourceSchemeNo;
    draft2.sourceBedId = bedId;
    draft2.sourceBedNo = bedNo;
    draft2.markerNo = bedNo;
    draft2.sourceMarkerNo = bedNo;
    draft2.theoreticalSpreadTotalLength = draft2.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0),
      0
    );
    draft2.theoreticalActualCutPieceQty = draft2.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0),
      0
    );
    const plannedCutGarmentQty = (draft2.planUnits || []).reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0),
      0
    );
    const plannedSpreadLengthM = (draft2.planUnits || []).reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0),
      0
    );
    if (!draft2.sourceMarkerId || !draft2.sourceSchemeId || !draft2.sourceBedId) {
      state.feedback = { tone: "warning", message: `\u551B\u67B6\u7F16\u53F7 ${bedNo || "\u5F85\u8865"} \u672A\u7ED1\u5B9A\u6765\u6E90\u551B\u67B6\u65B9\u6848\u3002` };
      return null;
    }
    if (plannedCutGarmentQty <= 0) {
      state.feedback = { tone: "warning", message: `\u551B\u67B6\u7F16\u53F7 ${bedNo || "\u5F85\u8865"} \u7684\u8BA1\u5212\u6210\u8863\u4EF6\u6570\u5FC5\u987B\u5927\u4E8E 0\u3002` };
      return null;
    }
    if (plannedSpreadLengthM <= 0) {
      state.feedback = { tone: "warning", message: `\u551B\u67B6\u7F16\u53F7 ${bedNo || "\u5F85\u8865"} \u7684\u8BA1\u5212\u94FA\u5E03\u603B\u957F\u5EA6\u5FC5\u987B\u5927\u4E8E 0\u3002` };
      return null;
    }
    drafts.push(draft2);
  }
  return drafts;
}
function confirmSpreadingCreate() {
  const drafts = buildCreateSessionsFromSelection();
  if (!drafts?.length) return true;
  const data = readMarkerSpreadingPrototypeData();
  const nextStore = drafts.reduce((store, draft2) => upsertSpreadingSession(draft2, store), data.store);
  persistMarkerSpreadingStore(nextStore);
  state.feedback = {
    tone: "success",
    message: drafts.length === 1 ? `\u5DF2\u521B\u5EFA\u5F85\u94FA\u5E03\u5355 ${drafts[0].sessionNo || ""}`.trim() : `\u5DF2\u6309\u551B\u67B6\u7F16\u53F7\u751F\u6210 ${drafts.length} \u5F20\u5F85\u94FA\u5E03\u5355\u3002`
  };
  if (drafts.length === 1) {
    const saved = nextStore.sessions.find((item) => item.spreadingSessionId === drafts[0].spreadingSessionId) || drafts[0];
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-edit"), buildContextPayloadFromSession(saved)));
    return true;
  }
  appStore.navigate(buildListRoute());
  return true;
}
function saveCurrentSpreading(goDetail, successMessage) {
  const draft2 = state.spreadingDraft;
  if (!draft2) return false;
  const { normalizedDraft } = buildPersistableSpreadingDraft(draft2);
  const data = readMarkerSpreadingPrototypeData();
  if (hasCuttingTableScheduleConflict(normalizedDraft, data.store.sessions)) {
    state.feedback = { tone: "warning", message: "\u8BE5\u88C1\u5E8A\u5F53\u524D\u65F6\u95F4\u6BB5\u5DF2\u6709\u94FA\u5E03\u4EFB\u52A1\u3002" };
    return true;
  }
  const nextStore = upsertSpreadingSession(normalizedDraft, data.store);
  persistMarkerSpreadingStore(nextStore);
  const saved = nextStore.sessions.find((item) => item.spreadingSessionId === draft2.spreadingSessionId) || normalizedDraft;
  state.spreadingDraft = cloneSpreadingSession(saved);
  state.spreadingCompletionSelection = saved.contextType === "marker-plan-ref" ? [...saved.completionLinkage?.linkedCutOrderIds || []] : [...saved.cutOrderIds];
  state.feedback = { tone: "success", message: successMessage || `${saved.sessionNo || "\u94FA\u5E03 session"} \u5DF2\u4FDD\u5B58\u3002` };
  if (goDetail) {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-detail"), buildContextPayloadFromSession(saved)));
  }
  return true;
}
function completeCurrentSpreading() {
  const draft2 = state.spreadingDraft;
  if (!draft2) return false;
  const { normalizedDraft, derived, primaryRows } = buildPersistableSpreadingDraft(draft2);
  const linkedCutOrderIds = buildSpreadingCompletionTargetIds(normalizedDraft);
  const validation = validateSpreadingCompletion({
    session: normalizedDraft,
    markerTotalPieces: derived.markerTotalPieces,
    selectedCutOrderIds: linkedCutOrderIds
  });
  if (!validation.allowed) {
    state.feedback = { tone: "warning", message: validation.messages.join("\uFF1B") };
    return true;
  }
  const linkedCutOrderNos = primaryRows.filter((row) => linkedCutOrderIds.includes(row.cutOrderId)).map((row) => row.cutOrderNo);
  const completionContext = primaryRows.length > 0 ? {
    contextType: normalizedDraft.contextType,
    cutOrderIds: [...normalizedDraft.cutOrderIds],
    cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
    markerPlanId: normalizedDraft.markerPlanId,
    markerPlanNo: normalizedDraft.markerPlanNo,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    styleCode: normalizedDraft.styleCode || primaryRows[0].styleCode,
    spuCode: normalizedDraft.spuCode || primaryRows[0].spuCode,
    styleName: primaryRows[0].styleName,
    materialSkuSummary: normalizedDraft.materialSkuSummary || primaryRows[0].materialSkuSummary,
    materialAliasSummary: Array.from(new Set(primaryRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias)).filter(Boolean))).join(" / "),
    materialImageUrl: primaryRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || "",
    materialPrepRows: primaryRows
  } : null;
  const completedDraft = finalizeSpreadingCompletion({
    session: normalizedDraft,
    context: completionContext,
    linkedCutOrderIds,
    linkedCutOrderNos,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    markerTotalPieces: derived.markerTotalPieces,
    materialAttr: primaryRows[0]?.materialLabel || primaryRows[0]?.materialCategory || "",
    warningMessages: derived.warningMessages,
    completedBy: "\u94FA\u5E03\u7F16\u8F91\u9875"
  });
  const data = readMarkerSpreadingPrototypeData();
  const nextStore = upsertSpreadingSession(completedDraft, data.store);
  persistMarkerSpreadingStore(nextStore);
  const saved = nextStore.sessions.find((item) => item.spreadingSessionId === completedDraft.spreadingSessionId) || completedDraft;
  state.spreadingDraft = cloneSpreadingSession(saved);
  state.spreadingCompletionSelection = saved.contextType === "marker-plan-ref" ? [...saved.completionLinkage?.linkedCutOrderIds || []] : [...saved.cutOrderIds];
  state.spreadingEditTab = "completion";
  state.feedback = {
    tone: "success",
    message: `\u5DF2\u5B8C\u6210\u94FA\u5E03\uFF0C\u672C\u94FA\u5E03\u5355\u88C1\u526A\u72B6\u6001\u5DF2\u8FDB\u5165\u5F85\u88C1\u526A\uFF1B\u88C1\u7247\u5355\u4EC5\u7D2F\u8BA1\u8FDB\u5EA6\uFF0C\u4E0D\u6539\u53D8\u4E3B\u72B6\u6001\u3002`
  };
  return true;
}
function persistCurrentSpreadingStatus(nextStatus) {
  const draft2 = state.spreadingDraft;
  if (!draft2) return false;
  if (nextStatus === "DONE") {
    state.feedback = {
      tone: "warning",
      message: "\u5DF2\u94FA\u5E03\u72B6\u6001\u53EA\u80FD\u901A\u8FC7\u201C\u5B8C\u6210\u94FA\u5E03\u201D\u4E3B\u6309\u94AE\u89E6\u53D1\u3002"
    };
    return false;
  }
  state.spreadingDraft = updateSessionStatus(draft2, nextStatus);
  return saveCurrentSpreading(false, `\u5F53\u524D\u94FA\u5E03 session \u5DF2\u6807\u8BB0\u4E3A\u201C${deriveSpreadingStatus(nextStatus).label}\u201D\u3002`);
}
function startSpreadingSession(sessionId, openEdit = true, startConfig = {}) {
  const session = getStoredSpreadingSession(sessionId);
  if (!session) return false;
  if (session.status === "DONE") {
    state.feedback = { tone: "warning", message: "\u5F53\u524D\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u4E0D\u80FD\u91CD\u65B0\u5F00\u59CB\u94FA\u5E03\u3002" };
    return true;
  }
  const cuttingTableId = startConfig.cuttingTableId || session.cuttingTableId || "";
  const ownerAccountId = startConfig.ownerAccountId || session.ownerAccountId || "";
  if (!cuttingTableId || !ownerAccountId) {
    state.feedback = { tone: "warning", message: "\u5F00\u59CB\u94FA\u5E03\u524D\u5FC5\u987B\u9009\u62E9\u88C1\u5E8A\u548C\u8D1F\u8D23\u4EBA\u3002" };
    return true;
  }
  const selectedTable = resolveCuttingTable(cuttingTableId);
  const ownerName = buildCreateOwnerLabel(ownerAccountId);
  const now = formatDateTimeLocal();
  const nextSession = {
    ...updateSessionStatus(session, "IN_PROGRESS"),
    cuttingTableId: selectedTable.cuttingTableId,
    cuttingTableNo: selectedTable.cuttingTableNo,
    cuttingTableName: selectedTable.cuttingTableName,
    ownerAccountId,
    ownerName,
    actualStartAt: session.actualStartAt || now,
    updatedAt: now
  };
  const data = readMarkerSpreadingPrototypeData();
  const nextStore = upsertSpreadingSession(nextSession, data.store);
  persistMarkerSpreadingStore(nextStore);
  if (state.spreadingDraft?.spreadingSessionId === nextSession.spreadingSessionId) {
    state.spreadingDraft = cloneSpreadingSession(nextSession);
  }
  state.feedback = { tone: "success", message: "\u5DF2\u5F00\u59CB\u94FA\u5E03\u3002" };
  if (openEdit) {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-edit"), buildContextPayloadFromSession(nextSession)));
  }
  return true;
}
function startCurrentSpreading() {
  const controls = document.querySelector('[data-spreading-start-controls="true"]');
  const cuttingTableId = controls?.querySelector('[data-cutting-spreading-start-field="cuttingTableId"]')?.value || "";
  const ownerAccountId = controls?.querySelector('[data-cutting-spreading-start-field="ownerAccountId"]')?.value || "";
  return startSpreadingSession(state.spreadingDraft?.spreadingSessionId, false, { cuttingTableId, ownerAccountId });
}
function updateSpreadingCuttingStatus(sessionId, nextStatus) {
  const session = getStoredSpreadingSession(sessionId);
  if (!session) return false;
  if (session.status !== "DONE") {
    state.feedback = { tone: "warning", message: "\u5B8C\u6210\u94FA\u5E03\u540E\u624D\u80FD\u66F4\u65B0\u88C1\u526A\u72B6\u6001\u3002" };
    return true;
  }
  if (nextStatus === "CUTTING" && session.cuttingStatus === "CUTTING_DONE") {
    state.feedback = { tone: "warning", message: "\u88C1\u526A\u5DF2\u5B8C\u6210\uFF0C\u4E0D\u80FD\u91CD\u65B0\u5F00\u59CB\u88C1\u526A\u3002" };
    return true;
  }
  if (nextStatus === "CUTTING_DONE" && session.cuttingStatus !== "CUTTING") {
    state.feedback = { tone: "warning", message: "\u5F00\u59CB\u88C1\u526A\u540E\u624D\u80FD\u5B8C\u6210\u88C1\u526A\u3002" };
    return true;
  }
  const now = formatDateTimeLocal();
  const nextSession = {
    ...session,
    cuttingStatus: nextStatus,
    cuttingStatusUpdatedAt: now,
    cuttingStartedAt: nextStatus === "CUTTING" ? session.cuttingStartedAt || now : nextStatus === "CUTTING_DONE" ? session.cuttingStartedAt || session.cuttingStatusUpdatedAt || now : session.cuttingStartedAt,
    cuttingFinishedAt: nextStatus === "CUTTING_DONE" ? now : session.cuttingFinishedAt,
    updatedAt: now
  };
  const data = readMarkerSpreadingPrototypeData();
  const nextStore = upsertSpreadingSession(nextSession, data.store);
  persistMarkerSpreadingStore(nextStore);
  state.feedback = { tone: "success", message: `\u88C1\u526A\u72B6\u6001\u5DF2\u66F4\u65B0\u4E3A\u201C${deriveSpreadingCuttingStatus(nextStatus).label}\u201D\u3002` };
  return true;
}
function closeMarkerEditOverlay() {
  const markerId = getSearchParams().get("markerId");
  if (markerId) {
    const row = getMarkerRow(markerId);
    if (row) {
      appStore.navigate(
        buildMarkerRouteWithContext(
          `${getCanonicalCuttingPath("marker-detail")}/${encodeURIComponent(row.markerId)}`,
          buildContextPayloadFromMarker(row.record)
        )
      );
      return true;
    }
  }
  appStore.navigate(getCanonicalCuttingPath("marker-list"));
  return true;
}
function closeSpreadingEditOverlay() {
  const sessionId = getSearchParams().get("sessionId");
  if (sessionId) {
    const row = getSpreadingRow(sessionId);
    if (row) {
      appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-detail"), buildContextPayloadFromSession(row.session)));
      return true;
    }
  }
  appStore.navigate(buildListRoute());
  return true;
}
function renderCraftCuttingMarkerSpreadingPage() {
  const currentPath = appStore.getState().pathname;
  const canonicalPath = buildCanonicalSpreadingListPathFromCurrentLocation();
  if (currentPath !== canonicalPath && getCurrentPathname() === getCanonicalCuttingPath("marker-spreading")) {
    queueMicrotask(() => {
      if (appStore.getState().pathname === currentPath) {
        appStore.navigate(canonicalPath);
      }
    });
    return `
      <div class="space-y-3 p-4">
        <div class="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">\u6B63\u5728\u8DF3\u8F6C\u5230\u94FA\u5E03\u5355\u2026</div>
      </div>
    `;
  }
  return renderPage();
}
function renderCraftCuttingSpreadingListPage() {
  return renderSpreadingSupervisorListPage();
}
function renderCraftCuttingSpreadingCreatePage() {
  return renderPage();
}
function renderCraftCuttingMarkerDetailPage() {
  return renderPage();
}
function renderCraftCuttingMarkerEditPage() {
  return renderPage();
}
function renderCraftCuttingSpreadingDetailPage() {
  return renderPage();
}
function renderCraftCuttingSpreadingEditPage() {
  return renderPage();
}
function handleCraftCuttingMarkerSpreadingEvent(target) {
  const spreadingListFieldNode = target.closest("[data-cutting-spreading-list-field]");
  if (spreadingListFieldNode) {
    const field = spreadingListFieldNode.dataset.cuttingSpreadingListField;
    const value = spreadingListFieldNode.value;
    if (field === "keyword") state.keyword = value;
    if (field === "context-no") state.contextNoFilter = value;
    if (field === "session-no") state.sessionNoFilter = value;
    if (field === "cut-order") state.cutOrderFilter = value;
    if (field === "marker-plan-ref") state.markerPlanRefFilter = value;
    if (field === "marker-no") state.markerNoFilter = value;
    if (field === "production-order") state.productionOrderFilter = value;
    if (field === "style-spu") state.styleSpuFilter = value;
    if (field === "material-sku") state.materialSkuFilter = value;
    if (field === "color") state.colorFilter = value;
    if (field === "mode") state.spreadingModeFilter = value;
    if (field === "context") state.contextTypeFilter = value;
    if (field === "main-stage") state.spreadingStageFilter = value;
    if (field === "source-channel") state.sourceChannelFilter = value;
    return true;
  }
  const spreadingCreateFieldNode = target.closest("[data-cutting-spreading-create-field]");
  if (spreadingCreateFieldNode) {
    const field = spreadingCreateFieldNode.dataset.cuttingSpreadingCreateField;
    const value = spreadingCreateFieldNode.value;
    if (field === "exception-backfill") {
      state.createExceptionBackfill = value === "true";
      if (!state.createExceptionBackfill) state.createExceptionReason = "";
      return true;
    }
    if (field === "exception-reason") {
      state.createExceptionReason = value;
      return true;
    }
    if (field === "owner-account") {
      state.createOwnerAccountId = value;
      getSelectedCreateSchemeSources().forEach((row, index) => {
        getCreateAssignment(row, index).ownerAccountId = value;
      });
      return true;
    }
    if (field === "schedule-mode") {
      state.createScheduleMode = value === "WHOLE_PLAN_ONE_TABLE" ? "WHOLE_PLAN_ONE_TABLE" : "BY_MARKER_NO";
      const selectedRows = getSelectedCreateSchemeSources();
      state.createAssignments = {};
      ensureCreateAssignments(selectedRows);
      return true;
    }
    if (field === "cutting-table-id") {
      state.createCuttingTableId = value;
      getSelectedCreateSchemeSources().forEach((row, index) => {
        getCreateAssignment(row, index).cuttingTableId = value;
      });
      return true;
    }
    if (field === "planned-start-at") {
      state.createPlannedStartAt = value;
      getSelectedCreateSchemeSources().forEach((row, index) => {
        const assignment = getCreateAssignment(row, index);
        assignment.plannedStartAt = state.createScheduleMode === "WHOLE_PLAN_ONE_TABLE" ? value : addMinutesToDateTimeLocal(value, index * DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES);
        assignment.plannedEndAt = addMinutesToDateTimeLocal(assignment.plannedStartAt, DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES);
      });
      return true;
    }
    if (field === "note") {
      state.createNote = value;
      return true;
    }
  }
  const spreadingCreateAssignmentNode = target.closest("[data-cutting-spreading-create-assignment-field]");
  if (spreadingCreateAssignmentNode) {
    const field = spreadingCreateAssignmentNode.dataset.cuttingSpreadingCreateAssignmentField;
    const markerId = spreadingCreateAssignmentNode.dataset.markerId || "";
    if (!field || !markerId) return false;
    const value = spreadingCreateAssignmentNode.value;
    const selectedRows = getSelectedCreateSchemeSources();
    const rowIndex = selectedRows.findIndex((row2) => getCreateAssignmentKey(row2) === markerId);
    const row = selectedRows[rowIndex];
    if (!row) return false;
    const assignment = getCreateAssignment(row, rowIndex);
    if (field === "cuttingTableId") {
      const matchedAssignment = getLatestCreateAssignmentForCuttingTable(value, markerId);
      assignment.cuttingTableId = value;
      if (matchedAssignment) {
        assignment.plannedStartAt = matchedAssignment.plannedStartAt;
        assignment.plannedEndAt = matchedAssignment.plannedEndAt;
        assignment.ownerAccountId = matchedAssignment.ownerAccountId;
      }
      syncCreateAssignmentsByCuttingTable(value, {
        plannedStartAt: assignment.plannedStartAt,
        plannedEndAt: assignment.plannedEndAt,
        ownerAccountId: assignment.ownerAccountId
      });
      return true;
    }
    assignment[field] = value;
    if (field === "plannedStartAt" || field === "plannedEndAt" || field === "ownerAccountId") {
      syncCreateAssignmentsByCuttingTable(assignment.cuttingTableId, { [field]: value });
    }
    return true;
  }
  const keywordNode = target.closest('[data-cutting-marker-field="keyword"]');
  if (keywordNode) {
    state.keyword = keywordNode.value;
    return true;
  }
  const markerModeFilterNode = target.closest('[data-cutting-marker-field="marker-mode-filter"]');
  if (markerModeFilterNode) {
    state.markerModeFilter = markerModeFilterNode.value;
    return true;
  }
  const contextTypeFilterNode = target.closest('[data-cutting-marker-field="context-type-filter"]');
  if (contextTypeFilterNode) {
    state.contextTypeFilter = contextTypeFilterNode.value;
    return true;
  }
  const adjustmentFilterNode = target.closest('[data-cutting-marker-field="adjustment-filter"]');
  if (adjustmentFilterNode) {
    state.adjustmentFilter = adjustmentFilterNode.value;
    return true;
  }
  const imageFilterNode = target.closest('[data-cutting-marker-field="image-filter"]');
  if (imageFilterNode) {
    state.imageFilter = imageFilterNode.value;
    return true;
  }
  const markerDraftFieldNode = target.closest("[data-cutting-marker-draft-field]");
  if (markerDraftFieldNode && state.markerDraft) {
    const field = markerDraftFieldNode.dataset.cuttingMarkerDraftField;
    if (!field) return false;
    const value = markerDraftFieldNode.value;
    if (field === "markerMode") {
      state.markerDraft.markerMode = value;
      ensureMarkerDraftShape(state.markerDraft);
      return true;
    }
    if (field === "adjustmentRequired") {
      ;
      state.markerDraft[field] = value === "true";
      return true;
    }
    if (field === "netLength" || field === "singlePieceUsage" || field === "spreadTotalLength" || field === "plannedLayerCount" || field === "plannedMarkerCount" || field === "markerLength" || field === "procurementUnitUsage" || field === "actualUnitUsage" || field === "plannedMaterialMeter" || field === "actualMaterialMeter" || field === "actualCutQty") {
      state.markerDraft[field] = Number(value);
      return true;
    }
    state.markerDraft[field] = value;
    return true;
  }
  const markerSizeFieldNode = target.closest("[data-cutting-marker-size-field]");
  if (markerSizeFieldNode && state.markerDraft) {
    const index = Number(markerSizeFieldNode.dataset.cuttingMarkerSizeIndex);
    const field = markerSizeFieldNode.dataset.cuttingMarkerSizeField;
    if (Number.isNaN(index) || !field || !state.markerDraft.sizeDistribution[index]) return false;
    if (field === "quantity") {
      state.markerDraft.sizeDistribution[index].quantity = Number(markerSizeFieldNode.value);
      return true;
    }
    state.markerDraft.sizeDistribution[index].sizeLabel = markerSizeFieldNode.value;
    return true;
  }
  const markerAllocationFieldNode = target.closest("[data-cutting-marker-allocation-field]");
  if (markerAllocationFieldNode && state.markerDraft) {
    const index = Number(markerAllocationFieldNode.dataset.cuttingMarkerAllocationIndex);
    const field = markerAllocationFieldNode.dataset.cuttingMarkerAllocationField;
    const allocationLine = state.markerDraft.allocationLines?.[index];
    if (Number.isNaN(index) || !field || !allocationLine) return false;
    const value = markerAllocationFieldNode.value;
    if (field === "sourceCutOrderId") {
      const sourceRows = getMarkerDraftSourceRows(state.markerDraft);
      const sourceRow = sourceRows.find((row) => row.sourceCutOrderId === value) || null;
      state.markerDraft.allocationLines[index] = applyAllocationSourceRowToLine(allocationLine, sourceRow, state.markerDraft);
      return true;
    }
    if (field === "plannedGarmentQty") {
      allocationLine.plannedGarmentQty = Number(value);
      return true;
    }
    ;
    allocationLine[field] = value;
    return true;
  }
  const markerLineFieldNode = target.closest("[data-cutting-marker-line-field]");
  if (markerLineFieldNode && state.markerDraft) {
    const index = Number(markerLineFieldNode.dataset.cuttingMarkerLineIndex);
    const field = markerLineFieldNode.dataset.cuttingMarkerLineField;
    const lineItem = state.markerDraft.lineItems?.[index];
    if (Number.isNaN(index) || !field || !lineItem) return false;
    const value = markerLineFieldNode.value;
    if (field === "markerLength" || field === "markerPieceCount" || field === "singlePieceUsage" || field === "spreadTotalLength" || field === "spreadRepeatCount") {
      ;
      lineItem[field] = Number(value);
      if (field === "markerPieceCount") {
        lineItem.pieceCount = Number(value);
      }
      if (field === "spreadTotalLength") {
        lineItem.spreadingTotalLength = Number(value);
      }
      return true;
    }
    if (field === "layoutDetailText") {
      lineItem.layoutDetailText = value;
      lineItem.ratioLabel = value;
      return true;
    }
    ;
    lineItem[field] = value;
    return true;
  }
  const highLowCuttingCellNode = target.closest("[data-cutting-marker-highlow-cutting-row-index]");
  if (highLowCuttingCellNode && state.markerDraft) {
    const rowIndex = Number(highLowCuttingCellNode.dataset.cuttingMarkerHighlowCuttingRowIndex);
    const cuttingRow = state.markerDraft.highLowCuttingRows?.[rowIndex];
    if (Number.isNaN(rowIndex) || !cuttingRow) return false;
    if (highLowCuttingCellNode.dataset.cuttingMarkerHighlowCuttingColor === "true") {
      cuttingRow.color = highLowCuttingCellNode.value;
      cuttingRow.total = MARKER_SIZE_KEYS.reduce((sum, sizeKey2) => sum + Math.max(cuttingRow.sizeValues[sizeKey2] || 0, 0), 0);
      return true;
    }
    const sizeKey = highLowCuttingCellNode.dataset.cuttingMarkerHighlowCuttingSize;
    if (sizeKey) {
      cuttingRow.sizeValues[sizeKey] = Number(highLowCuttingCellNode.value);
      cuttingRow.total = MARKER_SIZE_KEYS.reduce((sum, key) => sum + Math.max(cuttingRow.sizeValues[key] || 0, 0), 0);
      return true;
    }
  }
  const highLowPatternKeyNode = target.closest("[data-cutting-marker-highlow-pattern-key-index]");
  if (highLowPatternKeyNode && state.markerDraft) {
    const patternIndex = Number(highLowPatternKeyNode.dataset.cuttingMarkerHighlowPatternKeyIndex);
    const nextKey = highLowPatternKeyNode.value.trim();
    const patternKeys = state.markerDraft.highLowPatternKeys || [];
    const currentKey = patternKeys[patternIndex];
    if (Number.isNaN(patternIndex) || !currentKey || !nextKey || currentKey === nextKey) return Boolean(currentKey);
    state.markerDraft.highLowPatternKeys = patternKeys.map((key, index) => index === patternIndex ? nextKey : key);
    state.markerDraft.highLowPatternRows = (state.markerDraft.highLowPatternRows || []).map((row) => {
      const nextValues = { ...row.patternValues, [nextKey]: row.patternValues[currentKey] || 0 };
      delete nextValues[currentKey];
      return { ...row, patternValues: nextValues };
    });
    return true;
  }
  const highLowPatternCellNode = target.closest("[data-cutting-marker-highlow-pattern-row-index]");
  if (highLowPatternCellNode && state.markerDraft) {
    const rowIndex = Number(highLowPatternCellNode.dataset.cuttingMarkerHighlowPatternRowIndex);
    const patternRow = state.markerDraft.highLowPatternRows?.[rowIndex];
    if (Number.isNaN(rowIndex) || !patternRow) return false;
    if (highLowPatternCellNode.dataset.cuttingMarkerHighlowPatternColor === "true") {
      patternRow.color = highLowPatternCellNode.value;
      patternRow.total = Object.values(patternRow.patternValues).reduce((sum, value) => sum + Math.max(value || 0, 0), 0);
      return true;
    }
    const patternKey = highLowPatternCellNode.dataset.cuttingMarkerHighlowPatternKey;
    if (patternKey) {
      patternRow.patternValues[patternKey] = Number(highLowPatternCellNode.value);
      patternRow.total = Object.values(patternRow.patternValues).reduce((sum, value) => sum + Math.max(value || 0, 0), 0);
      return true;
    }
  }
  const spreadingDraftFieldNode = target.closest("[data-cutting-spreading-draft-field]");
  if (spreadingDraftFieldNode && state.spreadingDraft) {
    const field = spreadingDraftFieldNode.dataset.cuttingSpreadingDraftField;
    if (!field) return false;
    const value = spreadingDraftFieldNode.value;
    if (field === "spreadingMode") {
      state.spreadingDraft.spreadingMode = value;
      return true;
    }
    if (field === "status") {
      if (value === "DONE") {
        state.feedback = {
          tone: "warning",
          message: "\u5DF2\u94FA\u5E03\u72B6\u6001\u53EA\u80FD\u901A\u8FC7\u201C\u5B8C\u6210\u94FA\u5E03\u201D\u4E3B\u6309\u94AE\u89E6\u53D1\u3002"
        };
        return true;
      }
      state.spreadingDraft.status = value;
      return true;
    }
    if (field === "importAdjustmentRequired") {
      state.spreadingDraft.importAdjustmentRequired = value === "true";
      return true;
    }
    if (field === "cuttingTableId") {
      const table = resolveCuttingTable(value);
      state.spreadingDraft.cuttingTableId = table.cuttingTableId;
      state.spreadingDraft.cuttingTableNo = table.cuttingTableNo;
      state.spreadingDraft.cuttingTableName = table.cuttingTableName;
      return true;
    }
    if (field === "plannedStartAt") {
      state.spreadingDraft.plannedStartAt = value;
      state.spreadingDraft.plannedEndAt = value ? addMinutesToDateTimeLocal(value, state.spreadingDraft.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES) : "";
      state.spreadingDraft.tableScheduleStatus = value ? "\u5DF2\u6392\u7A0B" : "\u672A\u6392\u7A0B";
      return true;
    }
    if (field === "plannedEndAt") {
      state.spreadingDraft.plannedEndAt = value;
      return true;
    }
    if (field === "plannedLayers" || field === "unitPrice") {
      ;
      state.spreadingDraft[field] = Number(value);
      if (field === "plannedLayers") {
        state.spreadingDraft.importAdjustmentRequired = true;
      }
      return true;
    }
    ;
    state.spreadingDraft[field] = value;
    if (field === "importAdjustmentNote" && value.trim()) {
      state.spreadingDraft.importAdjustmentRequired = true;
    }
    return true;
  }
  const spreadingRollFieldNode = target.closest("[data-cutting-spreading-roll-field]");
  if (spreadingRollFieldNode && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    const index = Number(spreadingRollFieldNode.dataset.cuttingSpreadingRollIndex);
    const field = spreadingRollFieldNode.dataset.cuttingSpreadingRollField;
    const roll = state.spreadingDraft.rolls[index];
    if (Number.isNaN(index) || !field || !roll) return false;
    const value = spreadingRollFieldNode.value;
    if (field === "planUnitId") {
      roll.planUnitId = value;
      syncDraftRollFromPlanUnit(state.spreadingDraft, roll);
      return true;
    }
    if (field === "width" || field === "labeledLength" || field === "actualLength" || field === "headLength" || field === "tailLength" || field === "layerCount") {
      ;
      roll[field] = Number(value);
      if (field === "layerCount") {
        syncDraftRollFromPlanUnit(state.spreadingDraft, roll);
      }
      return true;
    }
    ;
    roll[field] = value;
    return true;
  }
  const spreadingOperatorFieldNode = target.closest("[data-cutting-spreading-operator-field]");
  if (spreadingOperatorFieldNode && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    const index = Number(spreadingOperatorFieldNode.dataset.cuttingSpreadingOperatorIndex);
    const field = spreadingOperatorFieldNode.dataset.cuttingSpreadingOperatorField;
    const operator = state.spreadingDraft.operators[index];
    if (Number.isNaN(index) || !field || !operator) return false;
    if (field === "actionType") {
      operator.actionType = spreadingOperatorFieldNode.value;
      operator.handoverFlag = operator.actionType === "\u4E2D\u9014\u4EA4\u63A5" || operator.actionType === "\u63A5\u624B\u7EE7\u7EED";
      return true;
    }
    if (field === "startLayer" || field === "endLayer" || field === "handledLength" || field === "unitPrice" || field === "adjustedAmount") {
      const rawValue = spreadingOperatorFieldNode.value;
      operator[field] = rawValue === "" ? void 0 : Number(rawValue);
      return true;
    }
    if (field === "manualAmountAdjusted") {
      operator.manualAmountAdjusted = spreadingOperatorFieldNode.value === "true";
      return true;
    }
    if (field === "pricingMode") {
      operator.pricingMode = spreadingOperatorFieldNode.value;
      return true;
    }
    ;
    operator[field] = spreadingOperatorFieldNode.value;
    if (field === "handoverNotes") {
      operator.handoverFlag = Boolean(operator.handoverNotes);
    }
    return true;
  }
  const actionNode = target.closest("[data-cutting-marker-action]");
  const action = actionNode?.dataset.cuttingMarkerAction;
  if (!action) return false;
  if (action === "close-overlay") {
    const currentPath = getCurrentPathname();
    if (currentPath === getCanonicalCuttingPath("spreading-edit")) return closeSpreadingEditOverlay();
    return false;
  }
  if (action === "clear-prefilter") {
    state.prefilter = null;
    state.drillContext = null;
    state.keyword = "";
    state.contextNoFilter = "";
    state.sessionNoFilter = "";
    appStore.navigate(getCanonicalCuttingPath("spreading-list"));
    return true;
  }
  if (action === "clear-filters") {
    state.keyword = "";
    state.contextNoFilter = "";
    state.sessionNoFilter = "";
    state.cutOrderFilter = "";
    state.markerPlanRefFilter = "";
    state.markerNoFilter = "";
    state.productionOrderFilter = "";
    state.styleSpuFilter = "";
    state.materialSkuFilter = "";
    state.colorFilter = "";
    state.contextTypeFilter = "ALL";
    state.spreadingModeFilter = "ALL";
    state.spreadingStageFilter = "ALL";
    state.sourceChannelFilter = "ALL";
    return true;
  }
  if (action === "switch-spreading-list-tab") {
    const nextTab = actionNode.dataset.listTab;
    if (!nextTab) return false;
    state.activeTab = nextTab;
    return true;
  }
  if (action === "switch-spreading-edit-tab") {
    const nextTab = actionNode.dataset.editTab;
    if (!nextTab) return false;
    state.spreadingEditTab = nextTab;
    return true;
  }
  if (action === "go-list") {
    appStore.navigate(buildListRoute());
    return true;
  }
  if (action === "create-spreading") {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-create"), buildCreatePayloadFromContext(null, null)));
    return true;
  }
  if (action === "create-spreading-exception") {
    state.feedback = { tone: "warning", message: "\u94FA\u5E03\u5FC5\u987B\u9009\u62E9\u4E00\u4E2A\u53EF\u6267\u884C\u7684\u551B\u67B6\u7F16\u53F7\u3002" };
    return true;
  }
  if (action === "select-spreading-create-marker") {
    const markerId = actionNode.dataset.markerId || "";
    state.selectedCreateMarkerId = markerId;
    const currentRows = getSpreadingCreateSourceRows();
    const selectedSource = currentRows.find((row) => row.markerId === markerId) || currentRows.find((row) => row.sourceBedId === markerId) || currentRows.find((row) => row.sourceSchemeId === markerId) || null;
    state.selectedCreateSourceSnapshot = selectedSource ? { ...selectedSource } : null;
    state.feedback = null;
    window.history.replaceState(
      window.history.state,
      "",
      buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-create"), { markerId })
    );
    document.querySelectorAll('[data-cutting-marker-action="select-spreading-create-marker"]').forEach((button) => {
      const isSelected = button.dataset.markerId === markerId;
      button.textContent = isSelected ? "\u5DF2\u9009\u4E2D" : "\u9009\u4E2D";
      button.classList.toggle("bg-blue-600", isSelected);
      button.classList.toggle("text-white", isSelected);
    });
    const nextButton = document.querySelector('[data-cutting-marker-action="next-spreading-create-step"]');
    if (nextButton) {
      nextButton.disabled = false;
      nextButton.classList.remove("cursor-not-allowed", "opacity-50");
      nextButton.classList.add("hover:bg-blue-700");
    }
    return true;
  }
  if (action === "next-spreading-create-step") {
    const source = getSelectedCreateSource();
    if (!source) {
      state.feedback = { tone: "warning", message: "\u521B\u5EFA\u94FA\u5E03\u9700\u5148\u9009\u4E2D\u4E00\u4E2A\u53EF\u94FA\u5E03\u7684\u551B\u67B6\u7F16\u53F7\u3002" };
      return true;
    }
    if (state.createStep === "SELECT_MARKER") {
      state.selectedCreateMarkerId = source.sourceSchemeId || source.markerId;
      state.selectedCreateSourceSnapshot = { ...source };
      state.createStep = "CONFIRM_CREATE";
      appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-create"), { markerId: state.selectedCreateMarkerId, step: "confirm" }));
      return true;
    }
    state.selectedCreateMarkerId = source.sourceSchemeId || source.markerId;
    state.selectedCreateSourceSnapshot = { ...source };
    state.createStep = "CONFIRM_CREATE";
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-create"), { markerId: state.selectedCreateMarkerId, step: "confirm" }));
    return true;
  }
  if (action === "prev-spreading-create-step") {
    state.createStep = "SELECT_MARKER";
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath("spreading-create"), {
      markerId: state.selectedCreateMarkerId || void 0
    }));
    return true;
  }
  if (action === "confirm-spreading-create") {
    return confirmSpreadingCreate();
  }
  if (action === "go-linked-marker-detail") {
    const markerId = actionNode.dataset.markerId;
    if (!markerId) return false;
    appStore.navigate(`${getCanonicalCuttingPath("marker-detail")}/${encodeURIComponent(markerId)}`);
    return true;
  }
  if (action === "open-spreading-detail") return navigateToSpreadingPage("detail", actionNode.dataset.sessionId);
  if (action === "open-spreading-edit") return navigateToSpreadingPage("edit", actionNode.dataset.sessionId);
  if (action === "start-spreading-session") {
    const controls = actionNode.closest('[data-spreading-start-controls="true"]');
    const cuttingTableId = controls?.querySelector('[data-cutting-spreading-start-field="cuttingTableId"]')?.value || "";
    const ownerAccountId = controls?.querySelector('[data-cutting-spreading-start-field="ownerAccountId"]')?.value || "";
    const inlineFeedback = controls?.querySelector("[data-spreading-start-feedback]");
    if (!cuttingTableId || !ownerAccountId) {
      if (inlineFeedback) {
        inlineFeedback.classList.remove("hidden");
        inlineFeedback.textContent = "\u5F00\u59CB\u94FA\u5E03\u524D\u5FC5\u987B\u9009\u62E9\u88C1\u5E8A\u548C\u8D1F\u8D23\u4EBA\u3002";
      }
      state.feedback = { tone: "warning", message: "\u5F00\u59CB\u94FA\u5E03\u524D\u5FC5\u987B\u9009\u62E9\u88C1\u5E8A\u548C\u8D1F\u8D23\u4EBA\u3002" };
      return true;
    }
    if (inlineFeedback) {
      inlineFeedback.classList.add("hidden");
      inlineFeedback.textContent = "";
    }
    return startSpreadingSession(actionNode.dataset.sessionId, true, { cuttingTableId, ownerAccountId });
  }
  if (action === "start-current-spreading") return startCurrentSpreading();
  if (action === "start-cutting") return updateSpreadingCuttingStatus(actionNode.dataset.sessionId, "CUTTING");
  if (action === "finish-cutting") return updateSpreadingCuttingStatus(actionNode.dataset.sessionId, "CUTTING_DONE");
  if (action === "open-pda-spreading-site") {
    const sessionId = actionNode.dataset.sessionId;
    if (!sessionId) return false;
    actionNode.textContent = "\u6253\u5F00\u4E2D";
    appStore.navigate(buildPdaCuttingMainlinePathForSession(sessionId, appStore.getState().pathname));
    return true;
  }
  if (action === "go-linked-cut-orders") return navigateFromSpreadingSession(actionNode.dataset.sessionId, "cut-orders");
  if (action === "go-linked-marker-plan") return navigateFromSpreadingSession(actionNode.dataset.sessionId, "marker-list");
  if (action === "go-spreading-replenishment") {
    const sessionId = actionNode.dataset.sessionId;
    if (!sessionId) return false;
    const row = getSpreadingRow(sessionId);
    if (!row) return false;
    const context = buildCuttingDrillContext(row.replenishmentPayload, "spreading-list", {
      productionOrderNo: row.productionOrderNos[0] || void 0,
      cutOrderNo: row.cutOrderNos[0] || void 0,
      markerPlanId: row.markerPlanId || void 0,
      markerPlanNo: row.markerPlanNo || void 0,
      materialSku: row.materialSkuSummary?.split(" / ")[0] || void 0,
      markerId: row.session.markerId || void 0,
      markerNo: row.session.markerNo || void 0,
      spreadingSessionId: row.spreadingSessionId,
      spreadingSessionNo: row.session.sessionNo || void 0,
      autoOpenDetail: true
    });
    appStore.navigate(buildCuttingRouteWithContext("replenishment", context));
    return true;
  }
  if (action === "launch-line-replenishment") {
    const context = buildCuttingDrillContext(
      {
        cutOrderId: actionNode.dataset.cutOrderId,
        cutOrderNo: actionNode.dataset.cutOrderNo,
        materialSku: actionNode.dataset.materialSku
      },
      "spreading-list",
      {
        markerId: state.spreadingDraft?.markerId || void 0,
        markerNo: state.spreadingDraft?.markerNo || void 0,
        autoOpenDetail: true
      }
    );
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath("replenishment"), {
        ...serializeCuttingDrillContext(context),
        color: actionNode.dataset.color || void 0
      })
    );
    return true;
  }
  if (action === "go-spreading-fei-tickets") {
    const sessionId = actionNode.dataset.sessionId;
    if (!sessionId) return false;
    const session = getStoredSpreadingSession(sessionId);
    if (!session) return false;
    appStore.navigate(
      buildCuttingRouteWithContext(
        "feiTickets",
        buildCuttingDrillContext(buildContextPayloadFromSession(session), "spreading-list", {
          markerPlanId: session.markerPlanId || void 0,
          markerPlanNo: session.markerPlanNo || void 0
        })
      )
    );
    return true;
  }
  if (action === "go-spreading-transfer-bags") {
    const sessionId = actionNode.dataset.sessionId;
    if (!sessionId) return false;
    const session = getStoredSpreadingSession(sessionId);
    if (!session) return false;
    appStore.navigate(
      buildCuttingRouteWithContext(
        "transferBags",
        buildCuttingDrillContext(buildContextPayloadFromSession(session), "spreading-list", {
          markerPlanId: session.markerPlanId || void 0,
          markerPlanNo: session.markerPlanNo || void 0
        })
      )
    );
    return true;
  }
  if (action === "go-spreading-warehouse") {
    const sessionId = actionNode.dataset.sessionId;
    if (!sessionId) return false;
    const session = getStoredSpreadingSession(sessionId);
    if (!session) return false;
    appStore.navigate(
      buildCuttingRouteWithContext(
        "cutPieceWarehouse",
        buildCuttingDrillContext(buildContextPayloadFromSession(session), "spreading-list", {
          markerPlanId: session.markerPlanId || void 0,
          markerPlanNo: session.markerPlanNo || void 0
        })
      )
    );
    return true;
  }
  if (action === "export-spreading-list") {
    const { filename, rows } = buildCurrentListExportRows(getPageData().spreadingRows);
    downloadCsvFile(filename, rows);
    state.feedback = {
      tone: "success",
      message: `\u5DF2\u5BFC\u51FA\u5F53\u524D\u89C6\u56FE\uFF1A${filename}`
    };
    return true;
  }
  if (action === "cancel-spreading-edit") {
    return closeSpreadingEditOverlay();
  }
  if (action === "return-summary") {
    const context = buildReturnToSummaryContext(state.drillContext);
    if (!context) return false;
    appStore.navigate(buildCuttingRouteWithContext("summary", context));
    return true;
  }
  if (action === "add-size-row" && state.markerDraft) {
    addMarkerSizeRow(state.markerDraft);
    return true;
  }
  if (action === "remove-size-row" && state.markerDraft) {
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    removeMarkerSizeRow(state.markerDraft, index);
    return true;
  }
  if (action === "add-allocation-line" && state.markerDraft) {
    addMarkerAllocationLine(state.markerDraft, getMarkerDraftSourceRows(state.markerDraft), createMarkerAllocationLineFromSource);
    return true;
  }
  if (action === "remove-allocation-line" && state.markerDraft) {
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    removeMarkerAllocationLine(state.markerDraft, index);
    return true;
  }
  if (action === "add-line-item" && state.markerDraft) {
    addMarkerLineItem(state.markerDraft, createEmptyMarkerLineItem);
    return true;
  }
  if (action === "remove-line-item" && state.markerDraft) {
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    removeMarkerLineItem(state.markerDraft, index);
    return true;
  }
  if (action === "add-highlow-cutting-row" && state.markerDraft) {
    addHighLowCuttingRow(state.markerDraft, createEmptyHighLowCuttingRow);
    return true;
  }
  if (action === "remove-highlow-cutting-row" && state.markerDraft) {
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    removeHighLowCuttingRow(state.markerDraft, index);
    return true;
  }
  if (action === "add-highlow-pattern-key" && state.markerDraft) {
    addHighLowPatternKey(state.markerDraft);
    return true;
  }
  if (action === "remove-highlow-pattern-key" && state.markerDraft) {
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    removeHighLowPatternKey(state.markerDraft, index);
    return true;
  }
  if (action === "add-highlow-pattern-row" && state.markerDraft) {
    addHighLowPatternRow(state.markerDraft, createEmptyHighLowPatternRow);
    return true;
  }
  if (action === "remove-highlow-pattern-row" && state.markerDraft) {
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    removeHighLowPatternRow(state.markerDraft, index);
    return true;
  }
  if (action === "add-roll" && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    addSpreadingRoll(state.spreadingDraft, (draft2) => ({
      ...createRollRecordDraft(
        draft2.spreadingSessionId,
        draft2.materialSkuSummary?.split(" / ")[0] || "",
        draft2.planUnits?.[0]?.planUnitId || ""
      ),
      sortOrder: draft2.rolls.length + 1
    }));
    return true;
  }
  if (action === "duplicate-roll" && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    const index = Number(actionNode.dataset.index);
    const current = state.spreadingDraft.rolls[index];
    if (Number.isNaN(index) || !current) return false;
    const cloned = cloneRollRecordForDraft(current, state.spreadingDraft, state.spreadingDraft.rolls.length);
    state.spreadingDraft.rolls = [...state.spreadingDraft.rolls, cloned].map((roll, itemIndex) => ({
      ...roll,
      sortOrder: itemIndex + 1
    }));
    state.feedback = { tone: "success", message: "\u5DF2\u590D\u5236\u5F53\u524D\u5377\u8BB0\u5F55\uFF0C\u8BF7\u8865\u5145\u65B0\u7684\u5377\u53F7\u548C\u8BB0\u5F55\u65F6\u95F4\u3002" };
    return true;
  }
  if (action === "remove-roll" && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    const feedbackMessage = removeSpreadingRoll(state.spreadingDraft, index);
    if (feedbackMessage) {
      state.feedback = { tone: "success", message: feedbackMessage };
    }
    return true;
  }
  if (action === "sync-spreading-rolls-from-pda" && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    return syncSpreadingDraftFromStoredPdaWriteback(state.spreadingDraft);
  }
  if (action === "add-operator" && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    addSpreadingOperator(state.spreadingDraft, (draft2) => ({
      ...createOperatorRecordDraft(draft2.spreadingSessionId),
      sortOrder: draft2.operators.length + 1,
      unitPrice: draft2.unitPrice,
      pricingMode: "\u6309\u4EF6\u8BA1\u4EF7"
    }));
    return true;
  }
  if (action === "add-operator-for-roll" && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    const rollRecordId = actionNode.dataset.rollRecordId;
    if (!rollRecordId) return false;
    addSpreadingOperatorForRoll(state.spreadingDraft, rollRecordId, createOperatorDraftForRoll);
    return true;
  }
  if (action === "remove-operator" && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true;
    const index = Number(actionNode.dataset.index);
    if (Number.isNaN(index)) return false;
    removeSpreadingOperator(state.spreadingDraft, index);
    return true;
  }
  if (action === "toggle-spreading-completion-order" && state.spreadingDraft) {
    const cutOrderId = actionNode.dataset.cutOrderId;
    if (!cutOrderId) return false;
    const checked = actionNode.checked;
    state.spreadingCompletionSelection = checked ? Array.from(/* @__PURE__ */ new Set([...state.spreadingCompletionSelection, cutOrderId])) : state.spreadingCompletionSelection.filter((item) => item !== cutOrderId);
    return true;
  }
  if (handleMarkerSpreadingSubmitAction({
    action,
    actionNode,
    saveSpreading: (goDetail, successMessage) => saveCurrentSpreading(goDetail, successMessage),
    completeSpreading: completeCurrentSpreading,
    persistSpreadingStatus: persistCurrentSpreadingStatus
  })) {
    return true;
  }
  return false;
}
function isCraftCuttingMarkerSpreadingDialogOpen() {
  const pathname = getCurrentPathname();
  return pathname === getCanonicalCuttingPath("spreading-edit") || pathname === getCanonicalCuttingPath("spreading-create");
}
export {
  handleCraftCuttingMarkerSpreadingEvent,
  isCraftCuttingMarkerSpreadingDialogOpen,
  renderCraftCuttingMarkerDetailPage,
  renderCraftCuttingMarkerEditPage,
  renderCraftCuttingMarkerSpreadingPage,
  renderCraftCuttingSpreadingCreatePage,
  renderCraftCuttingSpreadingDetailPage,
  renderCraftCuttingSpreadingEditPage,
  renderCraftCuttingSpreadingListPage
};
