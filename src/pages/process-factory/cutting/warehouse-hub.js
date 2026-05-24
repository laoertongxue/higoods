import {
  listCuttingSpecialCraftDispatchViews,
  listCuttingSpecialCraftReturnViews
} from "../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts";
import {
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory,
  getCuttingSewingDispatchBatchHandoverSummary,
  getCuttingSewingDispatchSummary,
  listAvailableCutPieceInventoryForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingDispatchValidationResults,
  listCuttingSewingTransferBags
} from "../../../data/fcs/cutting/sewing-dispatch.ts";
import {
  listSpreadingResultGeneratedFeiTickets
} from "../../../data/fcs/cutting/generated-fei-tickets.ts";
import {
  buildHandoverAfterRecordResult,
  buildSpecialCraftHandoverGroups,
  buildSpecialCraftReturnProjection,
  buildUniversalHandoverProjection
} from "../../../data/fcs/cutting/handover-orders.ts";
import { listMaterialLedgerProjections } from "../../../data/fcs/cutting/material-ledger.ts";
import { escapeHtml } from "../../../utils.ts";
import { buildCutPieceWarehouseProjection } from "./cut-piece-warehouse-projection.ts";
import { buildFabricWarehouseProjection } from "./fabric-warehouse-projection.ts";
import { renderCompactKpiCard, renderStickyTableScroller } from "./layout.helpers.ts";
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from "./meta.ts";
import { buildTransferBagsProjection } from "./transfer-bags-projection.ts";
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel
} from "./transfer-bags-model.ts";
import { getWarehouseSearchParams } from "./warehouse-shared.ts";
import { renderMaterialIdentityBlock } from "./material-identity.ts";
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar
} from "../shared/warehouse-standard.ts";
function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
}
function formatLength(value, unit = "\u7C73") {
  return `${formatNumber(value)} ${unit}`;
}
function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}
function buildWaitProcessMaterialLedgerSummary() {
  const rows = listMaterialLedgerProjections();
  const unit = rows[0]?.unit || "\u7C73";
  const requiredQty = rows.reduce((sum, item) => sum + Number(item.requiredMaterialQty || 0), 0);
  const configuredQty = rows.reduce((sum, item) => sum + Number(item.transferWarehouseAllocatedQty || 0), 0);
  const claimedQty = rows.reduce((sum, item) => sum + Number(item.cuttingClaimedQty || 0), 0);
  const lockedQty = rows.reduce((sum, item) => sum + Number(item.markerLockedQty || 0), 0);
  const consumedQty = rows.reduce((sum, item) => sum + Number(item.spreadingConsumedQty || 0), 0);
  const availableQty = rows.reduce((sum, item) => sum + Number(item.availableQty || 0), 0);
  const latestClaimEvent = rows.map((item) => item.latestClaimEvent).filter((event) => Boolean(event)).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, "zh-CN"))[0] || null;
  return {
    requiredQty,
    configuredQty,
    claimedQty,
    lockedQty,
    consumedQty,
    availableQty,
    unit,
    rows,
    latestClaimEvent
  };
}
function renderWaitProcessLedgerPreview(rows) {
  const visibleRows = rows.filter((row) => row.cuttingClaimedQty > 0 || row.availableQty > 0).sort((left, right) => right.availableQty - left.availableQty || left.cutOrderNo.localeCompare(right.cutOrderNo, "zh-CN")).slice(0, 4);
  return `
    <article class="rounded-lg border bg-card p-4 xl:col-span-2">
      <h2 class="text-base font-semibold">\u88C1\u7247\u5355\u5F85\u52A0\u5DE5\u4ED3\u6570\u91CF\u8D26</h2>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        ${visibleRows.map((row) => `
            <div class="rounded-md border bg-background p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">${renderMaterialIdentityBlock(row.materialIdentity, { compact: true, imageSizeClass: "h-9 w-9", showCategory: false })}</div>
                <div class="shrink-0 text-right text-xs">
                  <div class="font-medium text-blue-600">${escapeHtml(row.cutOrderNo)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(row.patternIdentity.patternFileName || "\u5F85\u8865\u7EB8\u6837")}</div>
                </div>
              </div>
              <dl class="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt class="text-muted-foreground">\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u6570\u91CF</dt><dd class="font-semibold tabular-nums">${escapeHtml(formatLength(row.transferWarehouseAllocatedQty, row.unit))}</dd></div>
                <div><dt class="text-muted-foreground">\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF</dt><dd class="font-semibold tabular-nums">${escapeHtml(formatLength(row.cuttingClaimedQty, row.unit))}</dd></div>
                <div><dt class="text-muted-foreground">\u53EF\u7528\u4F59\u989D</dt><dd class="font-semibold tabular-nums text-emerald-600">${escapeHtml(formatLength(row.availableQty, row.unit))}</dd></div>
              </dl>
              <div class="mt-2 text-xs text-muted-foreground">\u6700\u8FD1\u9886\u6599\u8BB0\u5F55\uFF1A${escapeHtml(row.latestClaimEvent ? `${row.latestClaimEvent.occurredAt} \xB7 ${row.latestClaimEvent.operatorName}` : "\u6682\u65E0")}</div>
            </div>
          `).join("") || '<div class="text-sm text-muted-foreground">\u6682\u65E0\u88C1\u5E8A\u9886\u6599\u6570\u91CF\u8D26\u3002</div>'}
      </div>
    </article>
  `;
}
function getSafeCuttingSewingDispatchSummary() {
  try {
    return getCuttingSewingDispatchSummary();
  } catch {
    return {
      waitingCompleteOrderCount: 0,
      readyBatchCount: 0,
      handedOverBatchCount: 0,
      writtenBackBatchCount: 0,
      differenceBatchCount: 0,
      objectionBatchCount: 0,
      remainingGarmentQty: 0
    };
  }
}
function renderHubActionCard(options) {
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(options.title)}</h2>
        </div>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${options.rows.map(
    ([label, value]) => `
              <div class="rounded-md border bg-background px-3 py-2">
                <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
                <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
              </div>
            `
  ).join("")}
      </dl>
    </article>
  `;
}
function renderHubGuideCard(title, lines) {
  return `
    <article class="rounded-lg border border-dashed bg-muted/20 p-4 xl:col-span-2">
      <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        ${lines.map(
    (line) => `
              <li class="flex gap-2">
                <span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>${escapeHtml(line)}</span>
              </li>
            `
  ).join("")}
      </ul>
    </article>
  `;
}
function renderHubTable(headers, rows, emptyText = "\u6682\u65E0\u6570\u636E") {
  if (!rows.length) {
    return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`;
  }
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          ${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
            <tr class="border-b last:border-b-0">
              ${row.map((cell) => `<td class="px-3 py-3 align-top">${escapeHtml(cell)}</td>`).join("")}
            </tr>
          `).join("")}
      </tbody>
    </table>
  `;
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, "max-h-[28rem]")}
    </div>
  `;
}
function renderLocationRows(scopeLabel, rows) {
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          <th class="px-3 py-2 font-medium">\u4ED3\u5E93</th>
          <th class="px-3 py-2 font-medium">\u5E93\u533A</th>
          <th class="px-3 py-2 font-medium">\u5E93\u4F4D</th>
          <th class="px-3 py-2 font-medium">\u627F\u8F7D\u5BF9\u8C61</th>
          <th class="px-3 py-2 font-medium">\u64CD\u4F5C</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(([warehouse, area, location, object]) => `
            <tr class="border-b last:border-b-0">
              <td class="px-3 py-3">${escapeHtml(warehouse)}</td>
              <td class="px-3 py-3">${escapeHtml(area)}</td>
              <td class="px-3 py-3">${escapeHtml(location)}</td>
              <td class="px-3 py-3">${escapeHtml(object)}</td>
              <td class="px-3 py-3">${renderWarehouseLocationActions(scopeLabel, `${area}/${location}`)}</td>
            </tr>
          `).join("")}
      </tbody>
    </table>
  `;
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, "max-h-[28rem]")}
    </div>
  `;
}
function readTabKey(fallback, supportedTabs) {
  const raw = getWarehouseSearchParams().get("tab");
  return supportedTabs.includes(raw) ? raw : fallback;
}
function buildHubTabHref(pageKey, tabKey) {
  const basePath = getCanonicalCuttingPath(pageKey);
  return tabKey === "overview" ? basePath : `${basePath}?tab=${encodeURIComponent(tabKey)}`;
}
function renderHubTabs(pageKey, activeTab, tabs) {
  return `
    <section class="rounded-lg border bg-card p-2">
      <div class="flex flex-wrap gap-2">
        ${tabs.map((tab) => {
    const isActive = tab.key === activeTab;
    return `
              <button
                type="button"
                class="rounded-md px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "border bg-background text-slate-700 hover:bg-muted"}"
                data-nav="${escapeHtml(buildHubTabHref(pageKey, tab.key))}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderHubShell(options) {
  const meta = getCanonicalCuttingMeta("", options.metaKey);
  return `
    <div class="space-y-5">
      ${renderCuttingPageHeader(meta)}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${options.kpis}
      </section>
      ${options.tabs}
      ${options.content}
    </div>
  `;
}
function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}
function formatPieceQty(value) {
  return `${formatNumber(value)} \u7247`;
}
function getSpecialCraftDisplay(ticket) {
  if (!ticket?.hasSpecialCraft || !ticket.specialCrafts.length) return "\u65E0";
  return uniqueStrings(ticket.specialCrafts.map((craft) => craft.craftType || craft.craftName)).join("\u3001") || "\u65E0";
}
function getReceiverFactoryDisplay(ticket) {
  if (!ticket?.hasSpecialCraft || !ticket.specialCrafts.length) return "\u65E0";
  return uniqueStrings(ticket.specialCrafts.map((craft) => craft.receiverFactoryName || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145")).join("\u3001") || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145";
}
function createWaitHandoverItemFromTicket(candidate, generatedTicket, options) {
  return {
    itemId: `${options.itemType}-${candidate.ticketRecordId}`,
    itemType: options.itemType,
    urgentLevel: "\u666E\u901A",
    updatedAt: generatedTicket?.issuedAt || "\u6700\u8FD1\u66F4\u65B0",
    productionOrderId: candidate.productionOrderId,
    productionOrderNo: candidate.productionOrderNo,
    cutOrderId: candidate.cutOrderId,
    cutOrderNo: candidate.cutOrderNo,
    spreadingOrderId: generatedTicket?.spreadingOrderId || candidate.sourceSpreadingSessionId,
    spreadingOrderNo: generatedTicket?.spreadingOrderNo || candidate.sourceSpreadingSessionNo,
    feiTicketIds: [candidate.feiTicketId],
    feiTicketNos: [candidate.ticketNo],
    spuCode: candidate.spuCode || generatedTicket?.sourceTechPackSpuCode || "\u672A\u5173\u8054 SPU",
    color: candidate.color || candidate.fabricColor || generatedTicket?.skuColor || "\u672A\u6807\u8BB0",
    size: candidate.size || generatedTicket?.skuSize || "\u672A\u6807\u8BB0",
    partName: candidate.partName || generatedTicket?.partName || "\u672A\u6807\u8BB0",
    pieceQty: Number(candidate.actualCutPieceQty || candidate.qty || generatedTicket?.actualCutPieceQty || 0),
    pieceSequenceLabel: generatedTicket?.pieceSequenceLabel || generatedTicket?.pieceSetNoRange || "\u6309\u83F2\u7968\u8FFD\u8E2A",
    hasSpecialCraft: Boolean(generatedTicket?.hasSpecialCraft),
    specialCraftDisplay: getSpecialCraftDisplay(generatedTicket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(generatedTicket),
    currentWarehouseArea: options.currentWarehouseArea || "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
    tempBagCodes: options.tempBagCodes || [],
    targetTaskId: options.targetTaskId || "",
    targetReceiver: options.targetReceiver || "",
    shortageAfterHandover: options.shortageAfterHandover || "\u4EA4\u51FA\u540E\u8BA1\u7B97",
    nextAction: options.nextAction,
    nextActionHref: options.nextActionHref,
    evidenceLines: options.evidenceLines || []
  };
}
function createWaitHandoverItemFromSortingTask(task, batch, generatedTicketsByNo, options) {
  const relatedTicket = task.targetTransferBagNos.concat(task.sourceTempBagNos).map((value) => generatedTicketsByNo[value]).filter(Boolean)[0];
  const skuLine = batch?.plannedSkuQtyLines[0];
  const pendingPieceQty = Math.max(task.expectedTicketCount - task.pickedTicketCount || task.expectedTicketCount, 0);
  return {
    itemId: `${options.itemType}-${task.sortingTaskId}`,
    itemType: options.itemType,
    urgentLevel: "\u666E\u901A",
    updatedAt: batch?.updatedAt || "\u6700\u8FD1\u66F4\u65B0",
    productionOrderId: batch?.productionOrderId || "",
    productionOrderNo: task.productionOrderNo || batch?.productionOrderNo || "\u672A\u5173\u8054\u751F\u4EA7\u5355",
    cutOrderId: "",
    cutOrderNo: batch?.transferOrderNo || "\u6309\u4EA4\u51FA\u4EFB\u52A1\u6C47\u603B",
    spreadingOrderId: relatedTicket?.spreadingOrderId || "",
    spreadingOrderNo: relatedTicket?.spreadingOrderNo || "",
    feiTicketIds: [],
    feiTicketNos: batch?.feiTicketNos || [],
    spuCode: task.skuSummary || relatedTicket?.sourceTechPackSpuCode || "\u6309\u8F66\u7F1D\u4EFB\u52A1\u6C47\u603B",
    color: skuLine?.colorName || relatedTicket?.skuColor || "\u591A\u989C\u8272",
    size: skuLine?.sizeCode || relatedTicket?.skuSize || "\u591A\u5C3A\u7801",
    partName: skuLine?.partName || relatedTicket?.partName || "\u591A\u90E8\u4F4D",
    pieceQty: pendingPieceQty,
    pieceSequenceLabel: relatedTicket?.pieceSequenceLabel || "\u6309\u83F2\u7968\u8FFD\u8E2A",
    hasSpecialCraft: Boolean(relatedTicket?.hasSpecialCraft),
    specialCraftDisplay: getSpecialCraftDisplay(relatedTicket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(relatedTicket),
    currentWarehouseArea: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
    tempBagCodes: task.sourceTempBagNos,
    targetTaskId: task.sortingTaskNo,
    targetReceiver: task.targetFactoryName,
    shortageAfterHandover: "\u4EA4\u51FA\u540E\u8BA1\u7B97",
    nextAction: options.nextAction,
    nextActionHref: options.nextActionHref,
    evidenceLines: options.evidenceLines || [
      `\u6765\u6E90\u6682\u5B58\u888B\uFF1A${task.sourceTempBagNos.join("\u3001") || "\u5F85\u786E\u8BA4"}`,
      `\u5DF2\u5206\u62E3\u83F2\u7968\uFF1A${task.pickedTicketCount}/${task.expectedTicketCount} \u5F20`,
      `\u76EE\u6807\u4E2D\u8F6C\u888B\uFF1A${task.targetTransferBagNos.join("\u3001") || "\u5F85\u91CD\u65B0\u88C5\u888B"}`
    ]
  };
}
function createWaitHandoverItemFromPickingTask(task, itemType, nextAction, nextActionHref) {
  const firstAllocated = task.allocatedInventoryItems[0];
  const totalPickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0);
  const shortagePreview = task.shortageItems.slice(0, 2).map((item) => `${item.size}/${item.partName} \u7F3A ${formatPieceQty(item.shortageQty)}`).join("\uFF1B") || "\u6682\u65E0\u7F3A\u53E3";
  return {
    itemId: `${itemType}-${task.pickingTaskId}`,
    itemType,
    urgentLevel: task.shortageItems.length ? "\u9AD8" : "\u666E\u901A",
    updatedAt: task.updatedAt,
    productionOrderId: "",
    productionOrderNo: firstAllocated?.feiTicketNo ? "\u6309\u83F2\u7968\u6765\u6E90\u8FFD\u8E2A" : "\u5F85\u5173\u8054\u751F\u4EA7\u5355",
    cutOrderId: "",
    cutOrderNo: firstAllocated?.feiTicketNo ? "\u6309\u5206\u914D\u5E93\u5B58\u8FFD\u8E2A" : "\u5F85\u5173\u8054\u88C1\u7247\u5355",
    spreadingOrderId: "",
    spreadingOrderNo: "",
    feiTicketIds: task.allocatedInventoryItems.map((item) => item.feiTicketId),
    feiTicketNos: task.allocatedInventoryItems.map((item) => item.feiTicketNo),
    spuCode: task.sewingTaskNo,
    color: "\u6309\u914D\u6599\u4EFB\u52A1\u6C47\u603B",
    size: firstAllocated?.size || "\u591A\u5C3A\u7801",
    partName: firstAllocated?.partName || "\u591A\u90E8\u4F4D",
    pieceQty: totalPickedQty || task.allocatedInventoryItems.reduce((total, item) => total + item.pieceQty, 0),
    pieceSequenceLabel: firstAllocated?.pieceSequenceLabel || "\u6309\u83F2\u7968\u8FFD\u8E2A",
    hasSpecialCraft: task.allocatedInventoryItems.some((item) => item.specialCraftReturnStatus !== "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A"),
    specialCraftDisplay: task.allocatedInventoryItems.some((item) => item.specialCraftReturnStatus !== "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A") ? "\u7279\u6B8A\u5DE5\u827A\u5DF2\u56DE\u4ED3\u6216\u5DF2\u6392\u9664" : "\u65E0",
    receiverFactoryDisplay: task.receiverFactoryName,
    currentWarehouseArea: task.sourceWarehouseName,
    tempBagCodes: task.tempBagSources.map((item) => item.tempBagCode),
    targetTaskId: task.pickingTaskNo,
    targetReceiver: task.receiverFactoryName,
    shortageAfterHandover: shortagePreview,
    nextAction,
    nextActionHref,
    evidenceLines: [
      `\u8F66\u7F1D\u4EFB\u52A1\uFF1A${task.sewingTaskNo}`,
      `\u6765\u6E90\u6682\u5B58\u888B\uFF1A${task.tempBagSources.map((item) => item.tempBagCode).join("\u3001") || "\u5F85\u626B\u63CF"}`,
      `\u5DF2\u5206\u62E3\uFF1A${formatPieceQty(totalPickedQty)}`,
      `\u76EE\u6807\u4E2D\u8F6C\u888B\uFF1A${task.targetTransferBags.map((bag) => bag.bagCode).join("\u3001") || "\u5F85\u91CD\u65B0\u88C5\u888B"}`,
      `\u5206\u62E3\u540E\u7F3A\u53E3\uFF1A${shortagePreview}`
    ]
  };
}
function createWaitHandoverItemFromBatch(batch, itemType, nextAction, nextActionHref) {
  const summary = getCuttingSewingDispatchBatchHandoverSummary(batch.dispatchBatchId);
  const skuLine = batch.plannedSkuQtyLines[0];
  const gapPreview = summary?.gapLines.slice(0, 2).map((line) => `${line.colorName}/${line.sizeCode}/${line.partName} \u7F3A ${line.missingPieceQty} \u7247`).join("\uFF1B");
  return {
    itemId: `${itemType}-${batch.dispatchBatchId}`,
    itemType,
    urgentLevel: "\u666E\u901A",
    updatedAt: batch.updatedAt,
    productionOrderId: batch.productionOrderId,
    productionOrderNo: batch.productionOrderNo,
    cutOrderId: "",
    cutOrderNo: batch.transferOrderNo,
    spreadingOrderId: "",
    spreadingOrderNo: "",
    feiTicketIds: [],
    feiTicketNos: batch.feiTicketNos,
    spuCode: skuLine?.skuCode || "\u6309\u4EA4\u51FA\u4EFB\u52A1\u6C47\u603B",
    color: skuLine?.colorName || "\u591A\u989C\u8272",
    size: skuLine?.sizeCode || "\u591A\u5C3A\u7801",
    partName: skuLine?.partName || "\u591A\u90E8\u4F4D",
    pieceQty: summary?.currentSubmittedPieceQty || batch.feiTicketNos.length,
    pieceSequenceLabel: "\u6309\u83F2\u7968\u8FFD\u8E2A",
    hasSpecialCraft: batch.plannedSkuQtyLines.some((line) => line.specialCraftRequired),
    specialCraftDisplay: batch.plannedSkuQtyLines.some((line) => line.specialCraftRequired) ? "\u542B\u7279\u6B8A\u5DE5\u827A\u90E8\u4F4D" : "\u65E0",
    receiverFactoryDisplay: "\u63A5\u6536\u5BF9\u8C61\u89C1\u4EA4\u51FA\u5355",
    currentWarehouseArea: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
    tempBagCodes: batch.transferBagIds,
    targetTaskId: batch.dispatchBatchNo,
    targetReceiver: "\u8F66\u7F1D\u5382",
    shortageAfterHandover: summary?.completeAfterSubmit ? "\u4EA4\u51FA\u540E\u65E0\u7F3A\u53E3" : gapPreview || "\u4EA4\u51FA\u540E\u4ECD\u6709\u7F3A\u53E3",
    nextAction,
    nextActionHref,
    evidenceLines: [
      `\u5DF2\u88C5\u888B\u6570\u91CF\uFF1A${batch.transferBagIds.length} \u888B`,
      `\u672C\u6B21\u53EF\u4EA4\u51FA\uFF1A${formatPieceQty(summary?.currentSubmittedPieceQty || batch.feiTicketNos.length)}`,
      `\u4E0A\u6B21\u4EA4\u51FA\uFF1A${formatPieceQty(summary?.previousSubmittedPieceQty || 0)}`
    ]
  };
}
function createWaitHandoverItemFromValidation(result, batch) {
  return {
    itemId: `discrepancy-${result.validationId}`,
    itemType: "\u63A5\u6536\u5DEE\u5F02 / \u4EA4\u51FA\u540E\u7F3A\u53E3",
    urgentLevel: result.blocking ? "\u9AD8" : "\u666E\u901A",
    updatedAt: "\u6700\u8FD1\u66F4\u65B0",
    productionOrderId: result.productionOrderId,
    productionOrderNo: result.productionOrderNo,
    cutOrderId: "",
    cutOrderNo: batch?.transferOrderNo || "\u6309\u4EA4\u51FA\u8BB0\u5F55\u8FFD\u8E2A",
    spreadingOrderId: "",
    spreadingOrderNo: "",
    feiTicketIds: [],
    feiTicketNos: batch?.feiTicketNos || [],
    spuCode: batch?.plannedSkuQtyLines[0]?.skuCode || "\u6309\u63A5\u6536\u5DEE\u5F02\u6C47\u603B",
    color: result.colorName,
    size: result.sizeCode,
    partName: result.partName,
    pieceQty: Math.max(result.missingPieceQty || result.overPieceQty || result.scannedPieceQty, 0),
    pieceSequenceLabel: "\u6309\u83F2\u7968\u8FFD\u8E2A",
    hasSpecialCraft: result.specialCraftRequired,
    specialCraftDisplay: result.specialCraftRequired ? result.specialCraftStatus : "\u65E0",
    receiverFactoryDisplay: "\u63A5\u6536\u5BF9\u8C61\u89C1\u4EA4\u51FA\u5355",
    currentWarehouseArea: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
    tempBagCodes: [result.transferBagId],
    targetTaskId: batch?.dispatchBatchNo || result.dispatchBatchId,
    targetReceiver: "\u63A5\u6536\u65B9",
    shortageAfterHandover: result.missingPieceQty > 0 ? `\u7F3A ${formatPieceQty(result.missingPieceQty)}` : result.overPieceQty > 0 ? `\u591A ${formatPieceQty(result.overPieceQty)}` : result.validationType,
    nextAction: "\u67E5\u770B\u5904\u7406\u8BB0\u5F55",
    nextActionHref: buildHubTabHref("warehouse-management-wait-handover", "handoverRecords"),
    evidenceLines: [
      `\u5DEE\u5F02\u7C7B\u578B\uFF1A${result.validationType}`,
      `\u5DEE\u5F02\u6570\u91CF\uFF1A${formatPieceQty(Math.max(result.missingPieceQty || result.overPieceQty || 0, 0))}`,
      `\u5F02\u8BAE\u72B6\u6001\uFF1A${result.validationMessage}`
    ]
  };
}
function buildWaitHandoverWorkbenchProjection(options) {
  const generatedTicketsByNo = Object.fromEntries(options.generatedTickets.map((ticket) => [ticket.feiTicketNo, ticket]));
  const printedCandidates = options.ticketCandidates.filter((ticket) => ticket.ticketStatus === "PRINTED" || ticket.ticketStatus === "REPRINTED").slice(0, 2);
  const pendingInboundItems = printedCandidates.map(
    (ticket) => createWaitHandoverItemFromTicket(ticket, generatedTicketsByNo[ticket.ticketNo], {
      itemType: "\u5F85\u5165\u4ED3\u786E\u8BA4",
      currentWarehouseArea: "\u5F85\u5165\u4ED3\u786E\u8BA4\u533A",
      nextAction: "\u786E\u8BA4\u5165\u4ED3 / \u67E5\u770B\u83F2\u7968",
      nextActionHref: "/fcs/craft/cutting/fei-tickets",
      evidenceLines: [
        "\u5DF2\u6253\u5370\u83F2\u7968\uFF0C\u7B49\u5F85\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u786E\u8BA4\u5165\u4ED3\u3002",
        `\u6765\u6E90\u94FA\u5E03\u5355\uFF1A${generatedTicketsByNo[ticket.ticketNo]?.spreadingOrderNo || ticket.sourceSpreadingSessionNo}`
      ]
    })
  );
  const pendingSortingItems = options.handoverPickingProjection.tasks.filter((task) => task.taskStatus === "\u5F85\u5206\u62E3" || task.taskStatus === "\u5206\u62E3\u4E2D" || task.shortageItems.length > 0).slice(0, 2).map(
    (task) => createWaitHandoverItemFromPickingTask(
      task,
      "\u5F85\u4E8C\u6B21\u5206\u62E3",
      "\u53BB\u4E8C\u6B21\u5206\u62E3",
      buildHubTabHref("warehouse-management-wait-handover", "sorting")
    )
  );
  const pendingRebaggingItems = options.handoverPickingProjection.tasks.filter((task) => task.taskStatus === "\u5DF2\u5206\u62E3\u5F85\u88C5\u888B" || task.taskStatus === "\u5DF2\u88C5\u888B\u5F85\u4EA4\u51FA" || task.targetTransferBags.length > 0).slice(0, 2).map(
    (task) => createWaitHandoverItemFromPickingTask(
      task,
      "\u5F85\u91CD\u65B0\u88C5\u888B",
      "\u91CD\u65B0\u88C5\u888B",
      buildHubTabHref("warehouse-management-wait-handover", "sorting")
    )
  );
  const pendingHandoverRecordItems = options.dispatchBatches.filter((batch) => batch.transferBagIds.length > 0 && !batch.handoverRecordNo).slice(0, 2).map(
    (batch) => createWaitHandoverItemFromBatch(
      batch,
      "\u5F85\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55",
      "\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55",
      buildHubTabHref("warehouse-management-wait-handover", "handoverRecords")
    )
  );
  const exceptionValidations = options.validationResults.filter((result) => result.validationType !== "\u901A\u8FC7").slice(0, 3);
  const discrepancyAndShortageItems = exceptionValidations.map(
    (result) => createWaitHandoverItemFromValidation(
      result,
      options.dispatchBatches.find((batch) => batch.dispatchBatchId === result.dispatchBatchId)
    )
  );
  const tempBagCodes = uniqueStrings(options.inboundTempBags.map((bag) => bag.bagCode));
  const inboundTempPieceQty = options.inboundTempBags.reduce((sum, bag) => sum + bag.totalPieceQty, 0);
  const specialCraftReturnPieceQty = options.specialCraftReturnInventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0);
  const inboundTempDiscrepancyCount = options.inboundTempBags.reduce((sum, bag) => sum + bag.discrepancyRecords.length, 0);
  const waitingReturnCount = options.returnRows.filter((row) => row.returnStatus !== "\u5DF2\u56DE\u4ED3").length + options.specialCraftReturnProjection.summary.waitingReturnCount;
  const returnedCount = options.returnRows.filter((row) => row.returnStatus === "\u5DF2\u56DE\u4ED3").length + options.specialCraftReturnProjection.summary.returnedCount;
  const differenceCount = options.returnRows.filter((row) => row.returnStatus === "\u5DEE\u5F02" || row.differenceQty > 0).length + options.specialCraftReturnProjection.summary.discrepancyCount;
  const specialCraftHandoverGroups = buildSpecialCraftHandoverGroups();
  const readySpecialCraftGroups = specialCraftHandoverGroups.filter((group) => group.canCreateHandover).length;
  const shortageCount = discrepancyAndShortageItems.filter((item) => item.shortageAfterHandover.includes("\u7F3A")).length;
  const overviewCards = [
    { label: "\u5F85\u5165\u4ED3\u786E\u8BA4\u88C1\u7247\u6570\u91CF", value: formatPieceQty(pendingInboundItems.reduce((sum, item) => sum + item.pieceQty, 0)), hint: "\u5DF2\u6253\u5370\u83F2\u7968\u8FDB\u5165\u88C1\u540E\u4ED3\u524D\u786E\u8BA4", tone: "text-blue-600" },
    { label: "\u5165\u4ED3\u6682\u5B58\u888B\u6570\u91CF", value: options.inboundTempBags.length, hint: `${formatPieceQty(inboundTempPieceQty)} \u5DF2\u626B\u7801\u5165\u4ED3`, tone: "text-slate-700" },
    { label: "\u88C1\u7247\u5E93\u5B58\u6570\u91CF", value: formatPieceQty(Math.max(options.cutPieceSummary.pieceQtyTotal, inboundTempPieceQty + specialCraftReturnPieceQty)), hint: `${options.inboundInventoryRecords.length + options.specialCraftReturnInventoryRecords.length} \u6761\u5165\u4ED3 / \u56DE\u4ED3\u5E93\u5B58\u8BB0\u5F55`, tone: "text-emerald-600" },
    { label: "\u5F85\u4E8C\u6B21\u5206\u62E3\u4EFB\u52A1\u6570\u91CF", value: pendingSortingItems.length || options.handoverPickingProjection.pendingCount + options.handoverPickingProjection.sortingCount, hint: "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u540E\u89E6\u53D1", tone: "text-amber-600" },
    { label: "\u5F85\u91CD\u65B0\u88C5\u888B\u6570\u91CF", value: pendingRebaggingItems.length || options.handoverPickingProjection.packedCount, hint: "\u4E8C\u6B21\u5206\u62E3\u540E\u91CD\u65B0\u88C5\u4E2D\u8F6C\u888B", tone: "text-violet-600" },
    { label: "\u5F85\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u6570\u91CF", value: pendingHandoverRecordItems.length || options.sewingSummary.readyBatchCount, hint: "\u9F50\u5957\u4E0D\u662F\u4EA4\u51FA\u524D\u7F6E\u6761\u4EF6", tone: "text-blue-600" },
    { label: "\u63A5\u6536\u5DEE\u5F02\u6570\u91CF", value: discrepancyAndShortageItems.length + options.sewingSummary.differenceBatchCount + options.sewingSummary.objectionBatchCount, hint: "\u63A5\u6536\u56DE\u5199\u548C\u5F02\u8BAE\u63D0\u793A", tone: "text-rose-600" },
    { label: "\u4EA4\u51FA\u540E\u7F3A\u53E3\u6570\u91CF", value: shortageCount, hint: "\u7F3A\u53E3\u4F5C\u4E3A\u4EA4\u51FA\u540E\u7ED3\u679C\u5C55\u793A", tone: "text-orange-600" },
    { label: "\u7279\u6B8A\u5DE5\u827A\u5F85\u4EA4\u51FA\u5F52\u7EC4", value: specialCraftHandoverGroups.length, hint: `${readySpecialCraftGroups} \u7EC4\u53EF\u751F\u6210\u901A\u7528\u4EA4\u51FA\u5355`, tone: "text-violet-600" }
  ];
  return {
    overviewCards,
    pendingInboundItems,
    pendingSortingItems,
    pendingRebaggingItems,
    pendingHandoverRecordItems,
    discrepancyAndShortageItems,
    specialCraftHandoverGroups,
    specialCraftReturnProjection: options.specialCraftReturnProjection,
    inboundTempBags: options.inboundTempBags,
    inboundInventoryRecords: options.inboundInventoryRecords,
    specialCraftReturnInventoryRecords: options.specialCraftReturnInventoryRecords,
    sewingAllocationProjection: options.sewingAllocationProjection,
    handoverPickingProjection: options.handoverPickingProjection,
    inventorySnapshot: {
      pieceQty: Math.max(
        options.cutPieceSummary.pieceQtyTotal,
        inboundTempPieceQty + options.specialCraftReturnInventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0)
      ),
      itemCount: Math.max(options.cutPieceSummary.totalItemCount, options.inboundInventoryRecords.length + options.specialCraftReturnInventoryRecords.length),
      unassignedCount: options.cutPieceItems.filter((item) => item.zoneCode === "UNASSIGNED").length
    },
    tempBagSnapshot: {
      tempBagCount: options.inboundTempBags.length,
      bagCount: options.transferBagSummary.bagCount,
      tempBagCodes: tempBagCodes.slice(0, 6),
      totalPieceQty: inboundTempPieceQty,
      mixedBagCount: options.inboundTempBags.filter((bag) => bag.mixedFlag).length,
      discrepancyCount: inboundTempDiscrepancyCount
    },
    specialCraftSnapshot: {
      waitingReturnCount,
      returnedCount,
      differenceCount,
      hint: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u4E0D\u5F71\u54CD\u5176\u4ED6\u5DF2\u88C1\u51FA\u90E8\u4F4D\u4EA4\u51FA\uFF1B\u56DE\u4ED3\u540E\u91CD\u65B0\u8FDB\u5165\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58\u3002"
    },
    handoverSnapshot: {
      handoverOrderCount: options.dispatchOrderCount,
      handoverRecordCount: options.dispatchBatches.filter((batch) => batch.handoverRecordNo).length,
      shortageCount,
      discrepancyCount: discrepancyAndShortageItems.length
    },
    updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
  };
}
function renderWaitHandoverItemCard(item) {
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">${escapeHtml(item.itemType)} \xB7 ${escapeHtml(item.updatedAt)}</div>
          <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(item.targetTaskId || item.feiTicketNos[0] || item.cutOrderNo)}</h4>
        </div>
        <button type="button" class="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(item.nextActionHref)}">${escapeHtml(item.nextAction)}</button>
      </div>
      <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div><span class="font-medium text-foreground">\u6765\u6E90\uFF1A</span>${escapeHtml(item.productionOrderNo)} / ${escapeHtml(item.cutOrderNo || "\u6309\u4EFB\u52A1\u6C47\u603B")}</div>
        <div><span class="font-medium text-foreground">\u88C1\u7247\uFF1A</span>${escapeHtml(item.spuCode)} ${escapeHtml(item.color)} ${escapeHtml(item.size)} ${escapeHtml(item.partName)} \xB7 ${escapeHtml(formatPieceQty(item.pieceQty))}</div>
        <div><span class="font-medium text-foreground">\u7F16\u53F7\u8303\u56F4\uFF1A</span>${escapeHtml(item.pieceSequenceLabel)}</div>
        <div><span class="font-medium text-foreground">\u6682\u5B58\u888B\uFF1A</span>${escapeHtml(item.tempBagCodes.join("\u3001") || "\u5F85\u786E\u8BA4")}</div>
        <div><span class="font-medium text-foreground">\u7279\u6B8A\u5DE5\u827A\uFF1A</span>${escapeHtml(item.specialCraftDisplay)}</div>
        <div><span class="font-medium text-foreground">\u627F\u63A5\u5DE5\u5382\uFF1A</span>${escapeHtml(item.receiverFactoryDisplay || item.targetReceiver || "\u5F85\u786E\u8BA4")}</div>
        <div><span class="font-medium text-foreground">\u63A5\u6536\u5BF9\u8C61\uFF1A</span>${escapeHtml(item.targetReceiver || "\u5F85\u786E\u8BA4")}</div>
        <div><span class="font-medium text-foreground">\u4EA4\u51FA\u540E\u7F3A\u53E3\uFF1A</span>${escapeHtml(item.shortageAfterHandover)}</div>
      </div>
      ${item.evidenceLines.length ? `<ul class="mt-3 space-y-1 text-xs text-muted-foreground">${item.evidenceLines.slice(0, 3).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
    </article>
  `;
}
function renderWaitHandoverWorkArea(title, subtitle, items, emptyText) {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(subtitle)}</p>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">${items.length} \u9879</span>
      </div>
      <div class="mt-4 space-y-3">
        ${items.length ? items.slice(0, 3).map((item) => renderWaitHandoverItemCard(item)).join("") : `<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`}
      </div>
    </section>
  `;
}
function renderSpecialCraftHandoverArea(groups) {
  return `
    <section class="rounded-lg border bg-card p-4 xl:col-span-2" data-section="special-craft-handover-candidates">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">\u7279\u6B8A\u5DE5\u827A\u5F85\u4EA4\u51FA\u5217\u8868</h3>
          <p class="mt-1 text-xs text-muted-foreground">\u57FA\u4E8E\u83F2\u7968\u7279\u6B8A\u5DE5\u827A\u5B57\u6BB5\u3001\u627F\u63A5\u5DE5\u5382\u548C\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58\uFF0C\u5F52\u5165\u901A\u7528\u4EA4\u51FA\u5355\u548C\u4EA4\u51FA\u8BB0\u5F55\u3002</p>
        </div>
        <span class="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">${groups.length} \u7EC4</span>
      </div>
      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        ${groups.length ? groups.slice(0, 8).map((group) => {
    const feiTicketCount = uniqueStrings(group.candidates.map((item) => item.feiTicketNo)).length;
    const statusText = group.handoverRecordNo ? `\u5DF2\u751F\u6210\u4EA4\u51FA\u8BB0\u5F55 ${group.handoverRecordNo}` : group.canCreateHandover ? "\u53EF\u751F\u6210\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u5355" : group.reasonTexts.join("\uFF1B") || "\u4E0D\u53EF\u751F\u6210\u6B63\u5F0F\u4EA4\u51FA\u5355";
    const operationText = group.handoverOrderNo ? "\u67E5\u770B\u4EA4\u51FA\u5355" : group.canCreateHandover ? "\u751F\u6210\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u5355" : "\u8865\u5145\u627F\u63A5\u5DE5\u5382";
    const operationHref = group.handoverOrderId ? `/fcs/craft/cutting/handover-orders/${encodeURIComponent(group.handoverOrderId)}` : "/fcs/craft/cutting/fei-tickets";
    return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(group.craftCategory)} / ${escapeHtml(group.craftType)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(group.receiverFactoryName)}</h4>
                        <div class="mt-1 text-xs text-muted-foreground">\u63A5\u6536\u5BF9\u8C61\uFF1A${escapeHtml(group.receiverType)} / \u627F\u63A5\u5DE5\u5382\uFF1A${escapeHtml(group.receiverFactoryCode)}</div>
                      </div>
                      <button type="button" class="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(operationHref)}">${escapeHtml(operationText)}</button>
                    </div>
                    <dl class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">\u83F2\u7968\uFF1A</span>${feiTicketCount} \u5F20</div>
                      <div><span class="font-medium text-foreground">\u88C1\u7247\u6570\u91CF\uFF1A</span>${escapeHtml(formatPieceQty(group.totalPieceQty))}</div>
                      <div><span class="font-medium text-foreground">\u901A\u7528\u4EA4\u51FA\u5355\uFF1A</span>${escapeHtml(group.handoverOrderNo || "\u5F85\u751F\u6210")}</div>
                      <div><span class="font-medium text-foreground">\u5F53\u524D\u72B6\u6001\uFF1A</span>${escapeHtml(statusText)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u5019\u9009\u83F2\u7968\uFF1A</span>${escapeHtml(group.candidates.slice(0, 3).map((item) => `${item.feiTicketNo}/${item.partName}/${item.size}/${item.currentInventoryStatus}`).join("\uFF1B"))}</div>
                    </dl>
                  </article>
                `;
  }).join("") : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground lg:col-span-2">\u6682\u65E0\u7279\u6B8A\u5DE5\u827A\u5F85\u4EA4\u51FA\u5019\u9009\u3002</div>'}
      </div>
      <div class="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        \u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u4E0D\u5F71\u54CD\u5176\u4ED6\u90E8\u4F4D\u4EA4\u7ED9\u8F66\u7F1D\u5382\uFF1B\u4E2D\u8F6C\u888B\u4ECD\u6309\u4F7F\u7528\u9636\u6BB5\u7BA1\u7406\uFF0C\u4E0D\u505A\u7269\u7406\u5206\u7C7B\u3002
      </div>
    </section>
  `;
}
function renderSpecialCraftReturnRecordCard(record) {
  const returnedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0);
  const expectedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.pieceQty, 0);
  const differenceQty = returnedQty - expectedQty;
  const firstItem = record.returnedFeiTicketItems[0];
  const nextAction = record.returnStatus === "\u5DF2\u56DE\u4ED3" ? "\u67E5\u770B\u56DE\u4ED3\u5E93\u5B58" : record.returnStatus === "\u90E8\u5206\u56DE\u4ED3" ? "\u7EE7\u7EED\u56DE\u4ED3 / \u5904\u7406\u5DEE\u5F02" : "\u5904\u7406\u56DE\u4ED3\u5DEE\u5F02";
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">${escapeHtml(record.craftCategory)} / ${escapeHtml(record.craftType)} \xB7 ${escapeHtml(record.returnedAt)}</div>
          <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(record.returnRecordNo)}</h4>
          <div class="mt-1 text-xs text-muted-foreground">\u6765\u6E90\u4EA4\u51FA\u5355\uFF1A${escapeHtml(record.sourceHandoverOrderNo)} / \u6765\u6E90\u4EA4\u51FA\u8BB0\u5F55\uFF1A${escapeHtml(record.sourceHandoverRecordNo)}</div>
        </div>
        <span class="rounded-full px-2.5 py-1 text-xs font-medium ${record.returnStatus === "\u5DF2\u56DE\u4ED3" ? "bg-emerald-100 text-emerald-700" : record.returnStatus === "\u90E8\u5206\u56DE\u4ED3" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}">${escapeHtml(record.returnStatus)}</span>
      </div>
      <dl class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div><span class="font-medium text-foreground">\u627F\u63A5\u5DE5\u5382\uFF1A</span>${escapeHtml(record.receiverFactoryName)}</div>
        <div><span class="font-medium text-foreground">\u56DE\u4ED3\u5E93\u533A\uFF1A</span>${escapeHtml(record.receivedWarehouseArea)} / ${escapeHtml(record.receivedLocationCode)}</div>
        <div><span class="font-medium text-foreground">\u83F2\u7968\u6570\u91CF\uFF1A</span>${record.returnedFeiTicketItems.length} \u5F20</div>
        <div><span class="font-medium text-foreground">\u5E94\u56DE / \u5B9E\u56DE\uFF1A</span>${escapeHtml(formatPieceQty(expectedQty))} / ${escapeHtml(formatPieceQty(returnedQty))}</div>
        <div><span class="font-medium text-foreground">\u5DEE\u5F02\u6570\u91CF\uFF1A</span>${escapeHtml(formatPieceQty(Math.abs(differenceQty)))}</div>
        <div><span class="font-medium text-foreground">\u56DE\u4ED3\u4EBA\uFF1A</span>${escapeHtml(record.returnedBy)}</div>
        <div class="sm:col-span-2"><span class="font-medium text-foreground">\u83F2\u7968\uFF1A</span>${escapeHtml(record.returnedFeiTicketItems.map((item) => `${item.feiTicketNo}/${item.partName}/${item.size}/${item.returnCheckResult}`).join("\uFF1B"))}</div>
        <div class="sm:col-span-2"><span class="font-medium text-foreground">\u53EF\u53C2\u4E0E\u8F66\u7F1D\u5206\u914D\uFF1A</span>${firstItem?.allRequiredCraftsReturned ? "\u662F\uFF0C\u5DF2\u91CD\u65B0\u8FDB\u5165\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58" : `\u6682\u4E0D\u53EF\uFF0C\u4ECD\u6709${escapeHtml(firstItem?.remainingSpecialCrafts.join("\u3001") || "\u56DE\u4ED3\u5DEE\u5F02")}\u9700\u5904\u7406`}</div>
      </dl>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref("warehouse-management-wait-handover", record.returnStatus === "\u5DF2\u56DE\u4ED3" ? "assignment" : "special-craft-return"))}">${escapeHtml(nextAction)}</button>
        <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u6A21\u62DF\u56DE\u4ED3\u786E\u8BA4</button>
      </div>
    </article>
  `;
}
function renderSpecialCraftReturnArea(projection) {
  return `
    <section class="space-y-4" data-section="special-craft-return">
      <article class="rounded-lg border bg-card p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="text-base font-semibold">\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3</h3>
            <p class="mt-1 text-xs text-muted-foreground">\u7279\u6B8A\u5DE5\u827A\u5B8C\u6210\u540E\u5173\u8054\u539F\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u5355\u548C\u4EA4\u51FA\u8BB0\u5F55\uFF1B\u56DE\u4ED3\u88C1\u7247\u91CD\u65B0\u8FDB\u5165\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58\u3002</p>
          </div>
          <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">${projection.summary.returnRecordCount} \u6761\u56DE\u4ED3\u8BB0\u5F55</span>
        </div>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u5F85\u56DE\u4ED3</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.waitingReturnCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u5DF2\u56DE\u4ED3</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.returnedCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u90E8\u5206\u56DE\u4ED3</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.partialReturnCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u56DE\u4ED3\u5DEE\u5F02</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.discrepancyCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u56DE\u4ED3\u5E93\u5B58</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.returnedInventoryCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u53EF\u53C2\u4E0E\u8F66\u7F1D</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.readyForSewingCount}</dd></div>
        </dl>
      </article>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold">\u5F85\u56DE\u4ED3 / \u90E8\u5206\u56DE\u4ED3</h4>
          <div class="mt-3 space-y-3">
            ${projection.records.filter((record) => record.returnStatus !== "\u5DF2\u56DE\u4ED3").length ? projection.records.filter((record) => record.returnStatus !== "\u5DF2\u56DE\u4ED3").map((record) => renderSpecialCraftReturnRecordCard(record)).join("") : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">\u6682\u65E0\u5F85\u56DE\u4ED3\u8BB0\u5F55\u3002</div>'}
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold">\u5DF2\u56DE\u4ED3\u5E93\u5B58</h4>
          <div class="mt-3 space-y-3">
            ${projection.returnedRecords.length ? projection.returnedRecords.map((record) => renderSpecialCraftReturnRecordCard(record)).join("") : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">\u6682\u65E0\u5DF2\u56DE\u4ED3\u8BB0\u5F55\u3002</div>'}
          </div>
        </article>
      </section>

      ${renderHubTable(
    ["\u56DE\u4ED3\u8BB0\u5F55", "\u6765\u6E90\u4EA4\u51FA\u5355", "\u6765\u6E90\u4EA4\u51FA\u8BB0\u5F55", "\u627F\u63A5\u5DE5\u5382", "\u5DE5\u827A\u7C7B\u578B", "\u83F2\u7968", "\u5E94\u56DE / \u5B9E\u56DE", "\u5DEE\u5F02", "\u56DE\u4ED3\u72B6\u6001", "\u56DE\u4ED3\u5E93\u533A", "\u4E0B\u4E00\u52A8\u4F5C"],
    projection.records.map((record) => {
      const expectedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.pieceQty, 0);
      const returnedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0);
      return [
        record.returnRecordNo,
        record.sourceHandoverOrderNo,
        record.sourceHandoverRecordNo,
        record.receiverFactoryName,
        record.craftType,
        record.returnedFeiTicketItems.map((item) => item.feiTicketNo).join("\u3001"),
        `${formatPieceQty(expectedQty)} / ${formatPieceQty(returnedQty)}`,
        record.discrepancyItems.length ? record.discrepancyItems.map((item) => `${item.discrepancyType} ${formatPieceQty(Math.abs(item.differenceQty))}`).join("\uFF1B") : "\u65E0",
        record.returnStatus,
        `${record.receivedWarehouseArea} / ${record.receivedLocationCode}`,
        record.returnStatus === "\u5DF2\u56DE\u4ED3" ? "\u8FDB\u5165\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D" : "\u5904\u7406\u56DE\u4ED3\u5DEE\u5F02"
      ];
    }),
    "\u6682\u65E0\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u8BB0\u5F55"
  )}
    </section>
  `;
}
function renderWaitHandoverSnapshotCard(title, rows) {
  return `
    <article class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
      <dl class="mt-4 grid gap-3 sm:grid-cols-3">
        ${rows.map(([label, value, fullWidth]) => `
            <div class="rounded-md border bg-background px-3 py-2 ${fullWidth ? "sm:col-span-3" : ""}">
              <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
              <dd class="mt-1 break-words text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
            </div>
          `).join("")}
      </dl>
    </article>
  `;
}
function renderWaitHandoverSnapshot(projection) {
  return `
    <section class="grid gap-4 xl:grid-cols-3">
      ${renderWaitHandoverSnapshotCard("\u88C1\u7247\u5E93\u5B58\u5FEB\u7167", [
    ["\u88C1\u7247\u5E93\u5B58\u6570\u91CF", formatPieceQty(projection.inventorySnapshot.pieceQty)],
    ["\u5E93\u5B58\u8BB0\u5F55\u6570", projection.inventorySnapshot.itemCount],
    ["\u672A\u5206\u533A\u8BB0\u5F55", projection.inventorySnapshot.unassignedCount]
  ])}
      ${renderWaitHandoverSnapshotCard("\u5165\u4ED3\u6682\u5B58\u888B\u5FEB\u7167", [
    ["\u5165\u4ED3\u6682\u5B58\u888B\u6570\u91CF", projection.tempBagSnapshot.tempBagCount],
    ["\u6682\u5B58\u88C1\u7247\u6570\u91CF", formatPieceQty(projection.tempBagSnapshot.totalPieceQty)],
    ["\u6DF7\u88C5\u888B\u6570\u91CF", projection.tempBagSnapshot.mixedBagCount],
    ["\u5165\u4ED3\u5DEE\u5F02\u8BB0\u5F55", projection.tempBagSnapshot.discrepancyCount],
    ["\u4E2D\u8F6C\u888B\u603B\u6570", projection.tempBagSnapshot.bagCount],
    ["\u793A\u4F8B\u6682\u5B58\u888B", projection.tempBagSnapshot.tempBagCodes.join("\u3001") || "\u6682\u65E0", true]
  ])}
      ${renderWaitHandoverSnapshotCard("\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u63D0\u793A", [
    ["\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3", projection.specialCraftSnapshot.waitingReturnCount],
    ["\u7279\u6B8A\u5DE5\u827A\u5DF2\u56DE\u4ED3", projection.specialCraftSnapshot.returnedCount],
    ["\u7279\u6B8A\u5DE5\u827A\u5DEE\u5F02", projection.specialCraftSnapshot.differenceCount],
    ["\u5904\u7406\u53E3\u5F84", projection.specialCraftSnapshot.hint, true]
  ])}
    </section>
  `;
}
function renderInboundTempBagArea(bags, inventoryRecords) {
  const totalInventoryQty = inventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0);
  return `
    <section class="rounded-lg border bg-card p-4" data-section="inbound-temp-bags">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">\u5165\u4ED3\u6682\u5B58\u888B</h3>
          <p class="mt-1 text-xs text-muted-foreground">\u88C1\u526A\u540E\u6253\u5B8C\u83F2\u7968\u5148\u626B\u7801\u5165\u4ED3\u6682\u5B58\uFF1B\u6B64\u9636\u6BB5\u5141\u8BB8\u4E0D\u540C\u751F\u4EA7\u5355\u3001SKU\u3001\u989C\u8272\u3001\u5C3A\u7801\u3001\u90E8\u4F4D\u548C\u7279\u6B8A\u5DE5\u827A\u8981\u6C42\u6DF7\u88C5\u3002</p>
        </div>
        <div class="text-xs text-muted-foreground">\u5DF2\u5F62\u6210\u5E93\u5B58\uFF1A${escapeHtml(formatPieceQty(totalInventoryQty))}</div>
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${bags.length ? bags.slice(0, 4).map((bag) => {
    const productionOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length;
    const cutOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length;
    const partCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.partName)).length;
    const hasSpecialCraft = bag.containedFeiTickets.some((ticket) => ticket.hasSpecialCraft);
    return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(bag.useStage)} \xB7 ${escapeHtml(bag.inboundAt || "\u5F85\u8BB0\u5F55\u5165\u4ED3\u65F6\u95F4")}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(bag.bagCode)}</h4>
                      </div>
                      <span class="rounded-full px-2.5 py-1 text-xs font-medium ${bag.mixedFlag ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}">${bag.mixedFlag ? "\u6DF7\u88C5" : "\u5355\u4E00\u6765\u6E90"}</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">\u5165\u4ED3\u4EBA\uFF1A</span>${escapeHtml(bag.inboundBy)}</div>
                      <div><span class="font-medium text-foreground">\u5E93\u533A / \u4F4D\u7F6E\uFF1A</span>${escapeHtml(bag.warehouseArea)} / ${escapeHtml(bag.locationCode)}</div>
                      <div><span class="font-medium text-foreground">\u83F2\u7968\u6570\u91CF\uFF1A</span>${bag.containedFeiTickets.length} \u5F20</div>
                      <div><span class="font-medium text-foreground">\u88C1\u7247\u6570\u91CF\uFF1A</span>${escapeHtml(formatPieceQty(bag.totalPieceQty))}</div>
                      <div><span class="font-medium text-foreground">\u751F\u4EA7\u5355\uFF1A</span>${productionOrderCount} \u4E2A</div>
                      <div><span class="font-medium text-foreground">\u88C1\u7247\u5355\uFF1A</span>${cutOrderCount} \u5F20</div>
                      <div><span class="font-medium text-foreground">\u90E8\u4F4D\uFF1A</span>${partCount} \u4E2A</div>
                      <div><span class="font-medium text-foreground">\u7279\u6B8A\u5DE5\u827A\uFF1A</span>${hasSpecialCraft ? "\u5305\u542B\u7279\u6B8A\u5DE5\u827A\u88C1\u7247" : "\u65E0"}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u6DF7\u88C5\u6982\u51B5\uFF1A</span>${escapeHtml(bag.mixedSummary)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u540E\u7EED\u4E8C\u6B21\u5206\u62E3\uFF1A</span>${escapeHtml(bag.nextSortingStatus)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u5165\u4ED3\u5DEE\u5F02\uFF1A</span>${bag.discrepancyRecords.length ? `${bag.discrepancyRecords.length} \u6761\u5F85\u5904\u7406` : "\u65E0"}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref("warehouse-management-wait-handover", "inventory"))}">\u67E5\u770B\u8BE6\u60C5</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u6838\u5BF9</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u5904\u7406\u5DEE\u5F02</button>
                    </div>
                  </article>
                `;
  }).join("") : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">\u6682\u65E0\u5165\u4ED3\u6682\u5B58\u888B\u3002</div>'}
      </div>
    </section>
  `;
}
function renderSewingAllocationArea(projection) {
  return `
    <section class="rounded-lg border bg-card p-4" data-section="sewing-allocation">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D</h3>
          <p class="mt-1 text-xs text-muted-foreground">\u57FA\u4E8E\u88C1\u7247\u5E93\u5B58\u5206\u914D\uFF0C\u53EA\u8BFB\u53D6\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5DF2\u6709\u83F2\u7968 / \u88C1\u7247\u5E93\u5B58\uFF1B\u4E0D\u4EE5\u9700\u6C42\u6570\u4F5C\u4E3A\u5206\u914D\u6765\u6E90\u3002</p>
        </div>
        <button type="button" class="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref("warehouse-management-wait-handover", "assignment"))}">\u8FDB\u5165\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D</button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u53EF\u5206\u914D\u5E93\u5B58\u8BB0\u5F55</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.availableInventoryCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u53EF\u5206\u914D\u88C1\u7247\u6570\u91CF</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(formatPieceQty(projection.availablePieceQty))}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u5E93\u5B58\u5360\u7528\u8BB0\u5F55</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.reservedInventoryCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.specialCraftPendingCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u5206\u914D\u540E\u7F3A\u53E3</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.shortageCount}</dd>
        </div>
      </dl>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${projection.allocations.length ? projection.allocations.slice(0, 4).map((allocation) => {
    const allocatedQty = allocation.allocatedItems.reduce((sum, item) => sum + item.pieceQty, 0);
    const shortagePreview = allocation.shortageItems.slice(0, 2).map((item) => `${item.size}/${item.partName} \u7F3A ${formatPieceQty(item.shortageQty)}`).join("\uFF1B") || "\u6682\u65E0\u7F3A\u53E3";
    const pendingPreview = allocation.specialCraftPendingItems.slice(0, 2).map((item) => `${item.partName} ${item.specialCraftType} ${formatPieceQty(item.pendingQty)}`).join("\uFF1B") || "\u65E0";
    return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(allocation.sourceType)} \xB7 ${escapeHtml(allocation.allocationStatus)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(allocation.sewingTaskNo)}</h4>
                      </div>
                      <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">\u57FA\u4E8E\u88C1\u7247\u5E93\u5B58\u5206\u914D</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">\u5206\u914D\u4F9D\u636E\uFF1A</span>${escapeHtml(allocation.allocationBasis)}</div>
                      <div><span class="font-medium text-foreground">\u63A5\u6536\u8F66\u7F1D\u5382\uFF1A</span>${escapeHtml(allocation.receiverFactoryName)}</div>
                      <div><span class="font-medium text-foreground">SPU / \u989C\u8272\uFF1A</span>${escapeHtml(allocation.spuCode)} / ${escapeHtml(allocation.color)}</div>
                      <div><span class="font-medium text-foreground">\u88C1\u7247\u6570\u91CF\uFF1A</span>${escapeHtml(formatPieceQty(allocatedQty))}</div>
                      <div><span class="font-medium text-foreground">\u6D89\u53CA\u83F2\u7968\uFF1A</span>${allocation.allocatedItems.length} \u5F20</div>
                      <div><span class="font-medium text-foreground">\u5E93\u5B58\u5360\u7528\uFF1A</span>${allocation.inventoryReservationIds.length} \u6761</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u5206\u914D\u540E\u7F3A\u53E3\uFF1A</span>${escapeHtml(shortagePreview)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\uFF1A</span>${escapeHtml(pendingPreview)}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u751F\u6210\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599\u4EFB\u52A1</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u67E5\u770B\u5206\u914D\u540E\u7F3A\u53E3</button>
                    </div>
                  </article>
                `;
  }).join("") : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">\u6682\u65E0\u53EF\u5206\u914D\u88C1\u7247\u5E93\u5B58\u3002</div>'}
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">\u5206\u914D\u89C4\u5219</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.ruleNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        </div>
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.specialCraftPendingItems.length ? projection.specialCraftPendingItems.slice(0, 4).map((item) => `<li>${escapeHtml(item.partName)}\uFF1A${escapeHtml(item.specialCraftType)} / ${escapeHtml(item.receiverFactoryName)}\uFF0C\u5F85\u56DE\u4ED3 ${escapeHtml(formatPieceQty(item.pendingQty))}</li>`).join("") : "<li>\u6682\u65E0\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u5E93\u5B58\u3002</li>"}
          </ul>
          <h4 class="mt-3 text-sm font-semibold">\u4E0D\u53C2\u4E0E\u672C\u6B21\u5206\u914D</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.excludedItems.length ? projection.excludedItems.slice(0, 5).map((item) => `<li>${escapeHtml(item.feiTicketNo)}\uFF1A${escapeHtml(item.exclusionReason)}</li>`).join("") : "<li>\u6682\u65E0\u88AB\u6392\u9664\u7684\u5E93\u5B58\u8BB0\u5F55\u3002</li>"}
          </ul>
          <div class="mt-2 text-xs text-muted-foreground">\u4EFB\u52A1\u53D6\u6D88\u91CA\u653E\u5360\u7528\uFF1A${projection.releasedReservations.length ? "\u5DF2\u6709\u91CA\u653E\u8BB0\u5F55" : "\u6682\u65E0\u91CA\u653E\u8BB0\u5F55"}</div>
        </div>
      </div>
    </section>
  `;
}
function renderHandoverPickingArea(projection) {
  return `
    <section class="rounded-lg border bg-card p-4" data-section="handover-picking">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599</h3>
          <p class="mt-1 text-xs text-muted-foreground">\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u540E\uFF0C\u4ECE\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5DF2\u6709\u83F2\u7968 / \u88C1\u7247\u5E93\u5B58\u4E2D\u4E8C\u6B21\u5206\u62E3\uFF1B\u8FD9\u662F\u88C1\u7247\u914D\u6599\uFF0C\u4E0D\u662F\u524D\u6BB5\u9762\u6599\u914D\u6599\u3002</p>
        </div>
        <button type="button" class="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref("warehouse-management-wait-handover", "sorting"))}">\u6253\u5F00\u88C1\u7247\u914D\u6599\u4EFB\u52A1</button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u88C1\u7247\u914D\u6599\u4EFB\u52A1</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.taskCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u5206\u62E3\u4E2D\u4EFB\u52A1</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.sortingCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u5DF2\u88C5\u888B\u5F85\u4EA4\u51FA</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.packedCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">\u76EE\u6807\u4E2D\u8F6C\u888B</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.targetTransferBagCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">PDA \u540C\u6B65\u5931\u8D25</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.syncFailedCount}</dd>
        </div>
      </dl>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${projection.tasks.length ? projection.tasks.slice(0, 4).map((task) => {
    const requiredQty = task.requiredItems.reduce((total, item) => total + item.requiredQty, 0);
    const allocatedQty = task.allocatedInventoryItems.reduce((total, item) => total + item.pieceQty, 0);
    const pickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0);
    const packedQty = task.targetTransferBags.reduce((total, bag) => total + bag.totalPieceQty, 0);
    const shortagePreview = task.shortageItems.slice(0, 2).map((item) => `${item.size}/${item.partName} \u7F3A ${formatPieceQty(item.shortageQty)}`).join("\uFF1B") || "\u6682\u65E0\u7F3A\u53E3";
    return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(task.taskStatus)} \xB7 ${escapeHtml(task.updatedAt)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(task.pickingTaskNo)}</h4>
                      </div>
                      <span class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">\u4E8C\u6B21\u5206\u62E3</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">\u8F66\u7F1D\u4EFB\u52A1\uFF1A</span>${escapeHtml(task.sewingTaskNo)}</div>
                      <div><span class="font-medium text-foreground">\u63A5\u6536\u5DE5\u5382\uFF1A</span>${escapeHtml(task.receiverFactoryName)}</div>
                      <div><span class="font-medium text-foreground">\u9700\u8981\u6570\u91CF\uFF1A</span>${escapeHtml(formatPieceQty(requiredQty))}</div>
                      <div><span class="font-medium text-foreground">\u5DF2\u5206\u914D\u5E93\u5B58\uFF1A</span>${escapeHtml(formatPieceQty(allocatedQty))}</div>
                      <div><span class="font-medium text-foreground">\u5DF2\u5206\u62E3\u6570\u91CF\uFF1A</span>${escapeHtml(formatPieceQty(pickedQty))}</div>
                      <div><span class="font-medium text-foreground">\u5DF2\u88C5\u888B\u6570\u91CF\uFF1A</span>${escapeHtml(formatPieceQty(packedQty))}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u6765\u6E90\u6682\u5B58\u888B\uFF1A</span>${escapeHtml(task.tempBagSources.map((item) => item.tempBagCode).join("\u3001") || "\u5F85\u626B\u63CF")}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u76EE\u6807\u4E2D\u8F6C\u888B\uFF1A</span>${escapeHtml(task.targetTransferBags.map((bag) => bag.bagCode).join("\u3001") || "\u5F85\u91CD\u65B0\u88C5\u888B")}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">\u5206\u62E3\u540E\u7F3A\u53E3\uFF1A</span>${escapeHtml(shortagePreview)}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u626B\u7801\u5206\u62E3</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u786E\u8BA4\u88C5\u888B</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">\u67E5\u770B\u7F3A\u53E3</button>
                    </div>
                  </article>
                `;
  }).join("") : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">\u6682\u65E0\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599\u4EFB\u52A1\u3002</div>'}
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">\u626B\u7801\u6821\u9A8C</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.scanChecks.length ? projection.scanChecks.slice(0, 8).map((check) => `<li>${escapeHtml(check.scanObject)} ${escapeHtml(check.scannedValue)}\uFF1A${escapeHtml(check.checkResult)}\uFF0C${escapeHtml(check.reason)}\uFF0C\u540C\u6B65\uFF1A${escapeHtml(check.syncStatus)}</li>`).join("") : "<li>\u6682\u65E0\u626B\u7801\u6821\u9A8C\u8BB0\u5F55\u3002</li>"}
          </ul>
        </div>
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">\u88C5\u888B\u89C4\u5219</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.ruleNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        </div>
      </div>
    </section>
  `;
}
function renderWaitHandoverWorkbench(projection) {
  return `
    <section class="space-y-4">
      ${renderWaitHandoverSnapshot(projection)}
      ${renderInboundTempBagArea(projection.inboundTempBags, projection.inboundInventoryRecords)}
      ${renderSewingAllocationArea(projection.sewingAllocationProjection)}
      ${renderSpecialCraftHandoverArea(projection.specialCraftHandoverGroups)}
      ${renderSpecialCraftReturnArea(projection.specialCraftReturnProjection)}
      ${renderHandoverPickingArea(projection.handoverPickingProjection)}
      <section class="grid gap-4 xl:grid-cols-2">
        ${renderWaitHandoverWorkArea("\u5F85\u5165\u4ED3\u786E\u8BA4", "\u5DF2\u6253\u5370\u83F2\u7968\u8FDB\u5165\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u524D\u7684\u786E\u8BA4\u5165\u53E3\u3002", projection.pendingInboundItems, "\u6682\u65E0\u5F85\u5165\u4ED3\u786E\u8BA4\u83F2\u7968\u3002")}
        ${renderWaitHandoverWorkArea("\u5F85\u4E8C\u6B21\u5206\u62E3", "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u540E\uFF0C\u4ECE\u5165\u4ED3\u6682\u5B58\u888B\u6309\u4EFB\u52A1\u62E3\u51FA\u88C1\u7247\u3002", projection.pendingSortingItems, "\u6682\u65E0\u5F85\u4E8C\u6B21\u5206\u62E3\u4EFB\u52A1\u3002")}
        ${renderWaitHandoverWorkArea("\u5F85\u91CD\u65B0\u88C5\u888B", "\u4E8C\u6B21\u5206\u62E3\u540E\u91CD\u65B0\u88C5\u5165\u4E2D\u8F6C\u888B\uFF0C\u51C6\u5907\u4EA4\u51FA\u3002", projection.pendingRebaggingItems, "\u6682\u65E0\u5F85\u91CD\u65B0\u88C5\u888B\u4EFB\u52A1\u3002")}
        ${renderWaitHandoverWorkArea("\u5F85\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55", "\u5DF2\u88C5\u888B\u540E\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\uFF1B\u9F50\u5957\u548C\u7F3A\u53E3\u5728\u4EA4\u51FA\u540E\u8BA1\u7B97\u3002", projection.pendingHandoverRecordItems, "\u6682\u65E0\u5F85\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u3002")}
        <div class="xl:col-span-2">
          ${renderWaitHandoverWorkArea("\u63A5\u6536\u5DEE\u5F02 / \u4EA4\u51FA\u540E\u7F3A\u53E3", "\u5C55\u793A\u63A5\u6536\u56DE\u5199\u5DEE\u5F02\u3001\u5F02\u8BAE\u548C\u4EA4\u51FA\u540E\u7F3A\u53E3\u3002", projection.discrepancyAndShortageItems, "\u6682\u65E0\u63A5\u6536\u5DEE\u5F02\u6216\u4EA4\u51FA\u540E\u7F3A\u53E3\u3002")}
        </div>
      </section>
    </section>
  `;
}
function mapSpecialCraftReturnInventoryForWaitHandover(records) {
  return records.map((record) => ({
    inventoryRecordId: record.inventoryRecordId,
    feiTicketId: record.feiTicketId,
    feiTicketNo: record.feiTicketNo,
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    spuCode: record.spuCode,
    color: record.color,
    size: record.size,
    partName: record.partName,
    pieceQty: record.pieceQty,
    pieceSequenceLabel: record.pieceSequenceLabel,
    hasSpecialCraft: !record.specialCraftReadyForSewing,
    specialCraftDisplay: record.specialCraftReadyForSewing ? `${record.specialCraftDisplay}\uFF0C\u53EF\u53C2\u4E0E\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D` : `${record.specialCraftDisplay}\uFF0C\u4ECD\u6709${record.remainingSpecialCraftDisplay || "\u56DE\u4ED3\u5DEE\u5F02"}\u5F85\u5904\u7406`,
    receiverFactoryDisplay: record.receiverFactoryDisplay,
    printStatus: "\u5DF2\u9996\u6253",
    voidStatus: "\u6709\u6548",
    tempBagCode: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3",
    warehouseArea: record.warehouseArea,
    locationCode: record.locationCode,
    inboundAt: record.inboundAt,
    inventoryStatus: record.inventoryStatus === "\u5F85\u5206\u914D" ? "\u5F85\u5206\u914D" : "\u5DF2\u4F5C\u5E9F\u6216\u4E0D\u53EF\u7528"
  }));
}
function renderCraftCuttingWarehouseManagementWaitProcessPage() {
  const fabricSummary = buildFabricWarehouseProjection().viewModel.summary;
  const materialLedgerSummary = buildWaitProcessMaterialLedgerSummary();
  const dispatchRows = listCuttingSpecialCraftDispatchViews();
  const generatedDispatchCount = dispatchRows.filter((row) => row.handoverRecordNo && row.handoverRecordNo !== "\u672A\u521B\u5EFA").length;
  const operationCount = uniqueCount(dispatchRows.map((row) => row.operationName));
  const factoryCount = uniqueCount(dispatchRows.map((row) => row.targetFactoryName));
  const activeTab = readTabKey("inventory", ["inventory", "receipts", "usage", "locations"]);
  const fabricWarehouseCard = renderHubActionCard({
    title: "\u5F85\u52A0\u5DE5\u4ED3\u9762\u6599\u6570\u91CF\u8D26",
    rows: [
      ["\u9700\u6C42\u7528\u91CF", formatLength(materialLedgerSummary.requiredQty, materialLedgerSummary.unit)],
      ["\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u6570\u91CF", formatLength(materialLedgerSummary.configuredQty, materialLedgerSummary.unit)],
      ["\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF", formatLength(materialLedgerSummary.claimedQty, materialLedgerSummary.unit)],
      ["\u5DF2\u9501\u5B9A\u6570\u91CF", formatLength(materialLedgerSummary.lockedQty, materialLedgerSummary.unit)],
      ["\u5DF2\u6D88\u8017\u6570\u91CF", formatLength(materialLedgerSummary.consumedQty, materialLedgerSummary.unit)],
      ["\u53EF\u7528\u4F59\u989D", formatLength(materialLedgerSummary.availableQty, materialLedgerSummary.unit)]
    ]
  });
  const specialCraftDispatchCard = renderHubActionCard({
    title: "\u7279\u6B8A\u5DE5\u827A\u5F85\u52A0\u5DE5 / \u4EA4\u51FA",
    rows: [
      ["\u5F85\u53D1\u8BB0\u5F55\u6570", dispatchRows.length],
      ["\u5DF2\u751F\u6210\u4EA4\u51FA\u5355\u6570", generatedDispatchCount],
      ["\u6D89\u53CA\u5DE5\u827A\u6570", operationCount],
      ["\u6D89\u53CA\u5DE5\u5382\u6570", factoryCount]
    ]
  });
  const standardTabs = [
    {
      key: "inventory",
      label: "\u5E93\u5B58",
      count: fabricSummary.stockItemCount + dispatchRows.length,
      content: `<section class="grid gap-4 xl:grid-cols-2">${fabricWarehouseCard}${specialCraftDispatchCard}${renderWaitProcessLedgerPreview(materialLedgerSummary.rows)}</section>`
    },
    {
      key: "receipts",
      label: "\u9886\u6599\u8BB0\u5F55",
      count: fabricSummary.rollCount + generatedDispatchCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
        title: "\u9762\u6599\u9886\u6599\u8BB0\u5F55",
        rows: [
          ["\u9886\u6599\u5377\u6570", fabricSummary.rollCount],
          ["\u9762\u6599 SKU \u6570", fabricSummary.stockItemCount],
          ["\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF", formatLength(materialLedgerSummary.claimedQty, materialLedgerSummary.unit)],
          ["\u53EF\u7528\u4F59\u989D", formatLength(materialLedgerSummary.availableQty, materialLedgerSummary.unit)],
          ["\u6700\u8FD1\u9886\u6599\u8BB0\u5F55", materialLedgerSummary.latestClaimEvent ? `${materialLedgerSummary.latestClaimEvent.cutOrderNo} \xB7 ${materialLedgerSummary.latestClaimEvent.occurredAt}` : "\u6682\u65E0"]
        ]
      })}
        ${renderHubActionCard({
        title: "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u8BB0\u5F55",
        rows: [
          ["\u5F85\u53D1\u8BB0\u5F55\u6570", dispatchRows.length],
          ["\u5DF2\u751F\u6210\u4EA4\u51FA\u5355\u6570", generatedDispatchCount],
          ["\u6D89\u53CA\u5DE5\u827A\u6570", operationCount],
          ["\u6D89\u53CA\u5DE5\u5382\u6570", factoryCount]
        ]
      })}
      </section>`
    },
    {
      key: "usage",
      label: "\u52A0\u5DE5\u7528\u6599\u8BB0\u5F55",
      count: fabricSummary.stockItemCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
        title: "\u94FA\u5E03\u88C1\u526A\u7528\u6599",
        rows: [
          ["\u914D\u7F6E\u957F\u5EA6\u603B\u91CF", `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
          ["\u5269\u4F59\u957F\u5EA6\u603B\u91CF", `${formatNumber(fabricSummary.remainingLengthTotal)} m`],
          ["\u5DF2\u6D88\u8017\u6570\u91CF", formatLength(materialLedgerSummary.consumedQty, materialLedgerSummary.unit)],
          ["\u4F4E\u4F59\u91CF\u9879\u6570", fabricSummary.lowRemainingItemCount]
        ]
      })}
        ${renderHubGuideCard("\u7528\u6599\u53E3\u5F84", ["\u5F85\u52A0\u5DE5\u4ED3\u5E93\u5B58\u7531\u9886\u6599\u5F62\u6210\u3002", "\u94FA\u5E03\u3001\u88C1\u526A\u3001\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u4F1A\u6263\u51CF\u5F85\u52A0\u5DE5\u4ED3\u5E93\u5B58\u3002"])}
      </section>`
    },
    {
      key: "locations",
      label: "\u5E93\u533A\u5E93\u4F4D",
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar("\u88C1\u5E8A\u5F85\u52A0\u5DE5\u4ED3")}</div>${renderLocationRows("\u88C1\u5E8A\u5F85\u52A0\u5DE5\u4ED3", [
        ["\u88C1\u5E8A\u5F85\u52A0\u5DE5\u4ED3", "\u9762\u6599 A \u533A", "FAB-A-01", "\u5F85\u88C1\u9762\u6599"],
        ["\u88C1\u5E8A\u5F85\u52A0\u5DE5\u4ED3", "\u9762\u6599 B \u533A", "FAB-B-02", "\u8865\u6599 / \u4F59\u6599"],
        ["\u7279\u6B8A\u5DE5\u827A\u5F85\u4EA4\u51FA\u533A", "\u4EA4\u51FA\u6682\u5B58\u533A", "SP-DISPATCH-01", "\u5F85\u4EA4\u51FA\u7279\u6B8A\u5DE5\u827A\u88C1\u7247"]
      ])}`
    }
  ];
  return renderHubShell({
    metaKey: "warehouse-management-wait-process",
    description: "\u67E5\u770B\u9886\u6599\u63A5\u6536\u540E\u7684\u5F85\u52A0\u5DE5\u4ED3\u3001\u88C1\u5E8A\u4ED3\u548C\u7279\u6B8A\u5DE5\u827A\u5F85\u52A0\u5DE5\u3002",
    kpis: [
      renderCompactKpiCard("\u9762\u6599 SKU \u6570", fabricSummary.stockItemCount, "\u88C1\u5E8A\u4ED3", "text-blue-600"),
      renderCompactKpiCard("\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u6570\u91CF", formatLength(materialLedgerSummary.configuredQty, materialLedgerSummary.unit), "\u5F85\u52A0\u5DE5\u4ED3\u9762\u6599\u6570\u91CF\u8D26", "text-blue-600"),
      renderCompactKpiCard("\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF", formatLength(materialLedgerSummary.claimedQty, materialLedgerSummary.unit), "\u5F85\u52A0\u5DE5\u4ED3\u9762\u6599\u6570\u91CF\u8D26", "text-slate-700"),
      renderCompactKpiCard("\u53EF\u7528\u4F59\u989D", formatLength(materialLedgerSummary.availableQty, materialLedgerSummary.unit), "\u5F85\u52A0\u5DE5\u4ED3\u9762\u6599\u6570\u91CF\u8D26", "text-emerald-600"),
      renderCompactKpiCard("\u5F85\u4EA4\u51FA\u7279\u6B8A\u5DE5\u827A\u8BB0\u5F55\u6570", dispatchRows.length, "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA", "text-amber-600")
    ].join(""),
    tabs: "",
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      "cutting-wait-process-standard-tabs"
    )
  });
}
function renderCraftCuttingWarehouseManagementWaitHandoverPage() {
  const cutPieceViewModel = buildCutPieceWarehouseProjection().viewModel;
  const cutPieceSummary = cutPieceViewModel.summary;
  const transferBagViewModel = buildTransferBagsProjection().viewModel;
  const generatedTickets = listSpreadingResultGeneratedFeiTickets();
  const dispatchOrders = listCuttingSewingDispatchOrders();
  const dispatchBatches = listCuttingSewingDispatchBatches();
  const transferBags = listCuttingSewingTransferBags();
  const validationResults = listCuttingSewingDispatchValidationResults();
  const availableSewingPieceInventory = listAvailableCutPieceInventoryForSewingDispatch();
  const returnRows = listCuttingSpecialCraftReturnViews();
  const sewingSummary = getSafeCuttingSewingDispatchSummary();
  const completedReturnCount = returnRows.filter((row) => row.returnStatus === "\u5DF2\u56DE\u4ED3").length;
  const returnDifferenceCount = returnRows.filter((row) => row.returnStatus === "\u5DEE\u5F02" || row.differenceQty > 0).length;
  const sortingTaskSummary = transferBagViewModel.sortingTaskSummary;
  const pendingSortingUsageCount = sortingTaskSummary.pendingCount + sortingTaskSummary.sortingCount;
  const sortedUsageCount = sortingTaskSummary.packedCount + sortingTaskSummary.handedOverCount;
  const exceptionValidationCount = validationResults.filter((result) => result.validationType !== "\u901A\u8FC7").length;
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel);
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags);
  const specialCraftReturnProjection = buildSpecialCraftReturnProjection();
  const specialCraftReturnInventoryRecords = specialCraftReturnProjection.inventoryRecords;
  const effectiveInventoryRecords = [
    ...inboundInventoryRecords,
    ...mapSpecialCraftReturnInventoryForWaitHandover(specialCraftReturnInventoryRecords)
  ];
  const sewingAllocationProjection = buildSewingTaskAllocationProjectionFromInventory(effectiveInventoryRecords);
  const handoverPickingProjection = buildHandoverPickingTaskProjectionFromAllocationProjection(sewingAllocationProjection);
  const universalHandoverProjection = buildUniversalHandoverProjection();
  const activeTab = readTabKey("workbench", ["workbench", "inventory", "assignment", "sorting", "special-craft-return", "handoverOrders", "handoverRecords", "locations"]);
  const assignedTaskCount = sewingAllocationProjection.allocations.length;
  const workbenchProjection = buildWaitHandoverWorkbenchProjection({
    ticketCandidates: transferBagViewModel.ticketCandidates,
    generatedTickets,
    inboundTempBags,
    inboundInventoryRecords,
    specialCraftReturnProjection,
    specialCraftReturnInventoryRecords,
    sewingAllocationProjection,
    handoverPickingProjection,
    cutPieceItems: cutPieceViewModel.items,
    cutPieceSummary,
    transferBagSummary: transferBagViewModel.summary,
    sortingTaskSummary,
    sortingTasks: transferBagViewModel.sortingTasks,
    dispatchBatches,
    validationResults,
    returnRows,
    dispatchOrderCount: dispatchOrders.length,
    sewingSummary
  });
  const cutPieceWarehouseCard = renderHubActionCard({
    title: "\u88C1\u7247\u5E93\u5B58",
    rows: [
      ["\u8BB0\u5F55\u6570", cutPieceSummary.totalItemCount],
      ["\u88C1\u7247\u603B\u6570\u91CF", cutPieceSummary.totalQuantity],
      ["\u83F2\u7968\u5E93\u5B58", transferBagViewModel.ticketCandidates.length],
      ["\u5DF2\u5165\u4ED3\u6570\u91CF", cutPieceSummary.inWarehouseCount],
      ["\u5F85\u4EA4\u51FA\u6570\u91CF", cutPieceSummary.waitingHandoffCount]
    ]
  });
  const specialCraftReturnCard = renderHubActionCard({
    title: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u8865\u5165\u5E93\u5B58",
    rows: [
      ["\u56DE\u4ED3\u8BB0\u5F55\u6570", returnRows.length + specialCraftReturnProjection.summary.returnRecordCount],
      ["\u5DF2\u5B8C\u6210\u56DE\u4ED3\u6570", completedReturnCount + specialCraftReturnProjection.summary.returnedCount],
      ["\u5DEE\u5F02\u6570", returnDifferenceCount + specialCraftReturnProjection.summary.discrepancyCount],
      ["\u56DE\u4ED3\u5E93\u5B58\u8BB0\u5F55", specialCraftReturnProjection.summary.returnedInventoryCount],
      ["\u53EF\u53C2\u4E0E\u8F66\u7F1D\u5206\u914D", specialCraftReturnProjection.summary.readyForSewingCount]
    ]
  });
  const sewingAssignmentCard = renderHubActionCard({
    title: "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D",
    rows: [
      ["\u53EF\u5206\u914D\u5E93\u5B58\u8BB0\u5F55", sewingAllocationProjection.availableInventoryCount],
      ["\u53EF\u5206\u914D\u88C1\u7247\u6570\u91CF", formatPieceQty(sewingAllocationProjection.availablePieceQty)],
      ["\u5E93\u5B58\u5360\u7528\u8BB0\u5F55", sewingAllocationProjection.reservedInventoryCount],
      ["\u5DF2\u91CA\u653E\u5360\u7528", sewingAllocationProjection.releasedReservations.length],
      ["\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3", sewingAllocationProjection.specialCraftPendingCount]
    ]
  });
  const sortingCard = renderHubActionCard({
    title: "\u5F85\u4EA4\u51FA\u4ED3\u914D\u6599",
    rows: [
      ["\u88C1\u7247\u914D\u6599\u4EFB\u52A1", handoverPickingProjection.taskCount],
      ["\u5F85\u5206\u62E3 / \u5206\u62E3\u4E2D", handoverPickingProjection.pendingCount + handoverPickingProjection.sortingCount],
      ["\u5DF2\u88C5\u888B\u5F85\u4EA4\u51FA", handoverPickingProjection.packedCount],
      ["\u5206\u62E3\u540E\u7F3A\u53E3", handoverPickingProjection.shortageCount],
      ["\u76EE\u6807\u4E2D\u8F6C\u888B\u6570", handoverPickingProjection.targetTransferBagCount],
      ["PDA \u540C\u6B65\u5931\u8D25", handoverPickingProjection.syncFailedCount]
    ]
  });
  const sewingDispatchCard = renderHubActionCard({
    title: "\u4EA4\u51FA\u5355",
    rows: [
      ["\u4EA4\u51FA\u5355\u6570", universalHandoverProjection.summary.orderCount],
      ["\u5F85\u6838\u5BF9 / \u5F85\u626B\u7801", sewingSummary.waitingCompleteOrderCount],
      ["\u53EF\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55", sewingSummary.readyBatchCount],
      ["\u4EA4\u51FA\u8BB0\u5F55\u6570", universalHandoverProjection.summary.recordCount],
      ["\u5DEE\u5F02 / \u5F02\u8BAE", universalHandoverProjection.summary.discrepancyCount + universalHandoverProjection.summary.objectionCount]
    ]
  });
  const cutPieceInventoryRows = cutPieceViewModel.items.slice(0, 8).map((item) => [
    item.cutOrderNo,
    item.productionOrderNo,
    item.materialSku,
    `${item.quantity} \u7247`,
    item.warehouseStatus.label.replace("\u4EA4\u63A5", "\u4EA4\u51FA"),
    item.bagCode ? `${item.bagCode}${item.bagUsageStageLabel ? ` / ${item.bagUsageStageLabel}` : ""}` : "\u672A\u5165\u6682\u5B58\u888B"
  ]);
  const sortingRows = handoverPickingProjection.tasks.slice(0, 8).map((task) => [
    task.pickingTaskNo,
    task.sewingTaskNo,
    task.tempBagSources.map((item) => item.tempBagCode).join("\u3001") || "\u5F85\u626B\u6765\u6E90\u6682\u5B58\u888B",
    task.targetTransferBags.map((bag) => bag.bagCode).join("\u3001") || "\u5F85\u626B\u76EE\u6807\u4E2D\u8F6C\u888B",
    `${task.pickedItems.length}/${task.allocatedInventoryItems.length} \u5F20`,
    task.receiverFactoryName,
    task.shortageItems.length ? task.shortageItems.slice(0, 2).map((item) => `${item.size}/${item.partName}\u7F3A${item.shortageQty}`).join("\uFF1B") : "\u6682\u65E0\u7F3A\u53E3",
    task.taskStatus
  ]);
  const handoverOrderRows = universalHandoverProjection.orders.slice(0, 8).map((order) => [
    order.handoverOrderNo,
    order.relatedProductionOrderIds.join("\u3001"),
    `${order.receiverType} / ${order.receiverName}`,
    `${order.totalHandedOverPieceQty} \u7247`,
    `${order.totalRecordCount} \u6761\u8BB0\u5F55`,
    order.status
  ]);
  const handoverRecordRows = universalHandoverProjection.records.slice(0, 8).map((record) => [
    record.handoverOrderNo,
    record.relatedProductionOrderIds.join("\u3001"),
    record.handoverRecordNo,
    record.previousHandedOverSummary.map((item) => item.summaryText).join("\uFF1B") || "0 \u7247",
    record.currentHandedOverSummary.map((item) => item.summaryText).join("\uFF1B") || "0 \u7247",
    record.cumulativeHandedOverSummary.map((item) => item.summaryText).join("\uFF1B") || "0 \u7247",
    buildHandoverAfterRecordResult(record).completenessResult.summaryText,
    record.transferBagUses.map((bag) => bag.bagCode).join("\u3001") || "\u672A\u88C5\u888B",
    record.recordStatus
  ]);
  const standardTabs = [
    {
      key: "workbench",
      label: "\u88C1\u540E\u5DE5\u4F5C\u53F0",
      count: workbenchProjection.pendingInboundItems.length + workbenchProjection.pendingSortingItems.length + workbenchProjection.pendingRebaggingItems.length + workbenchProjection.pendingHandoverRecordItems.length + workbenchProjection.discrepancyAndShortageItems.length,
      content: renderWaitHandoverWorkbench(workbenchProjection)
    },
    {
      key: "inventory",
      label: "\u88C1\u7247\u5E93\u5B58",
      count: cutPieceSummary.totalItemCount,
      content: `<section class="space-y-4">
        <div class="grid gap-4 xl:grid-cols-2">${cutPieceWarehouseCard}${specialCraftReturnCard}</div>
        ${renderHubTable(["\u88C1\u7247\u5355", "\u751F\u4EA7\u5355", "\u9762\u6599", "\u5E93\u5B58\u6570\u91CF", "\u5E93\u5B58\u72B6\u6001", "\u5165\u4ED3\u6682\u5B58\u888B"], cutPieceInventoryRows)}
      </section>`
    },
    {
      key: "assignment",
      label: "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D",
      count: assignedTaskCount,
      content: `<section class="space-y-4">
        ${sewingAssignmentCard}
        ${renderSewingAllocationArea(sewingAllocationProjection)}
      </section>`
    },
    {
      key: "sorting",
      label: "\u5F85\u4EA4\u51FA\u4ED3\u914D\u6599",
      count: handoverPickingProjection.taskCount,
      content: `<section class="space-y-4">
        ${sortingCard}
        ${renderHandoverPickingArea(handoverPickingProjection)}
        ${renderHubTable(["\u914D\u6599\u4EFB\u52A1", "\u8F66\u7F1D\u4EFB\u52A1", "\u6765\u6E90\u6682\u5B58\u888B", "\u76EE\u6807\u4E2D\u8F6C\u888B", "\u5DF2\u5206\u62E3\u83F2\u7968", "\u63A5\u6536\u5BF9\u8C61", "\u5206\u62E3\u540E\u7F3A\u53E3", "\u72B6\u6001"], sortingRows)}
      </section>`
    },
    {
      key: "special-craft-return",
      label: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3",
      count: specialCraftReturnProjection.summary.returnRecordCount,
      content: renderSpecialCraftReturnArea(specialCraftReturnProjection)
    },
    {
      key: "handoverOrders",
      label: "\u4EA4\u51FA\u5355",
      count: universalHandoverProjection.summary.orderCount,
      content: `<section class="space-y-4">
        ${sewingDispatchCard}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/handover-orders">\u6253\u5F00\u4EA4\u51FA\u5355\u5217\u8868</button>
        </div>
        ${renderHubTable(["\u4EA4\u51FA\u5355", "\u751F\u4EA7\u5355", "\u63A5\u6536\u5BF9\u8C61", "\u7D2F\u8BA1\u5DF2\u4EA4", "\u4EA4\u51FA\u8BB0\u5F55", "\u72B6\u6001"], handoverOrderRows)}
      </section>`
    },
    {
      key: "handoverRecords",
      label: "\u4EA4\u51FA\u8BB0\u5F55",
      count: universalHandoverProjection.summary.recordCount,
      content: `<section class="space-y-4">
        ${renderHubActionCard({
        title: "\u4EA4\u51FA\u8BB0\u5F55",
        rows: [
          ["\u5DF2\u751F\u6210\u8BB0\u5F55\u6570", universalHandoverProjection.summary.recordCount],
          ["\u5DF2\u4EA4\u51FA\u6279\u6B21", sewingSummary.handedOverBatchCount],
          ["\u5DF2\u56DE\u5199\u6279\u6B21", sewingSummary.writtenBackBatchCount],
          ["\u5DEE\u5F02 / \u5F02\u8BAE\u8BB0\u5F55", universalHandoverProjection.summary.discrepancyCount + universalHandoverProjection.summary.objectionCount]
        ]
      })}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/handover-orders">\u6253\u5F00\u4EA4\u51FA\u5355\u5217\u8868</button>
        </div>
        ${renderHubTable(["\u4EA4\u51FA\u8BB0\u5F55\u6765\u6E90", "\u751F\u4EA7\u5355", "\u4EA4\u51FA\u8BB0\u5F55", "\u4E4B\u524D\u5DF2\u4EA4", "\u672C\u6B21\u4EA4\u51FA", "\u7D2F\u8BA1\u4EA4\u51FA", "\u4EA4\u51FA\u540E\u7ED3\u679C", "\u4E2D\u8F6C\u888B", "\u72B6\u6001"], handoverRecordRows)}
      </section>`
    },
    {
      key: "locations",
      label: "\u5E93\u533A\u5E93\u4F4D",
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar("\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3")}</div>${renderLocationRows("\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3", [
        ["\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3", "\u88C1\u7247 A \u533A", "CUT-A-01", "\u5F85\u4EA4\u51FA\u88C1\u7247"],
        ["\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3", "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u533A", "SP-RETURN-01", "\u56DE\u4ED3\u88C1\u7247"],
        ["\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3", "\u4E2D\u8F6C\u888B\u6682\u5B58\u533A", "BAG-A-01", "\u5F85\u4EA4\u51FA\u4E2D\u8F6C\u888B"]
      ])}`
    }
  ];
  return renderHubShell({
    metaKey: "warehouse-management-wait-handover",
    description: "\u805A\u5408\u5DF2\u6253\u5370\u83F2\u7968\u3001\u88C1\u7247\u5E93\u5B58\u3001\u5165\u4ED3\u6682\u5B58\u888B\u3001\u4E8C\u6B21\u5206\u62E3\u3001\u91CD\u65B0\u88C5\u888B\u3001\u4EA4\u51FA\u8BB0\u5F55\u548C\u63A5\u6536\u5DEE\u5F02\u3002",
    kpis: workbenchProjection.overviewCards.map((card) => renderCompactKpiCard(card.label, card.value, card.hint, card.tone)).join(""),
    tabs: "",
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      "cutting-wait-handover-standard-tabs"
    )
  });
}
export {
  renderCraftCuttingWarehouseManagementWaitHandoverPage,
  renderCraftCuttingWarehouseManagementWaitProcessPage
};
