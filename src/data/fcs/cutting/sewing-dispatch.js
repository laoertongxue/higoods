import { productionOrders } from "../production-orders.ts";
import { getProductionOrderTechPackSnapshot } from "../production-order-tech-pack-runtime.ts";
import { mockFactories } from "../factory-mock-data.ts";
import {
  linkHandoverRecordToOutboundRecord,
  syncQuantityObjectionToOutboundRecord,
  syncReceiverWritebackToOutboundRecord
} from "../factory-warehouse-linkage.ts";
import {
  createFactoryHandoverRecord,
  findPdaHandoverRecord,
  reportPdaHandoverQtyObjection,
  upsertPdaHandoutRecordMock,
  upsertPdaHandoverHeadMock,
  writeBackHandoverRecord
} from "../pda-handover-events.ts";
import { buildHandoverOrderQrValue } from "../task-qr.ts";
import {
  getFeiTicketByNo,
  listSpreadingResultGeneratedFeiTickets
} from "./generated-fei-tickets.ts";
import {
  getSpecialCraftFeiTicketSummary,
  listCuttingSpecialCraftFeiTicketBindingsForProjection
} from "./special-craft-fei-ticket-flow.ts";
let store = null;
function clone(value) {
  return structuredClone(value);
}
function nowText() {
  return "2026-04-23 10:00:00";
}
function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
function isHandoverGapResult(result) {
  return !result.blocking && result.validationType !== "\u901A\u8FC7";
}
function formatDispatchGapLine(result) {
  const subject = [result.colorName, result.sizeCode, result.partName].filter(Boolean).join("/");
  if (result.validationType === "\u7F3A\u5C11\u88C1\u7247") {
    return `${subject || "\u88C1\u7247"}\u7F3A ${result.missingPieceQty} \u7247`;
  }
  if (result.validationType === "\u88C1\u7247\u8D85\u51FA") {
    return `${subject || "\u88C1\u7247"}\u591A ${result.overPieceQty} \u7247`;
  }
  if (result.validationType === "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3" || result.validationType === "\u7279\u6B8A\u5DE5\u827A\u5DEE\u5F02" || result.validationType === "\u7279\u6B8A\u5DE5\u827A\u5F02\u8BAE\u4E2D") {
    return `${subject || "\u88C1\u7247"}${result.validationMessage}`;
  }
  return `${subject || "\u88C1\u7247"}${result.validationMessage}`;
}
function buildDispatchGapSummary(results) {
  const gaps = results.filter(isHandoverGapResult);
  if (!gaps.length) return "";
  const preview = gaps.slice(0, 4).map(formatDispatchGapLine);
  const restCount = Math.max(gaps.length - preview.length, 0);
  return `\u4EA4\u51FA\u540E\u7F3A\u53E3\uFF1A${preview.join("\uFF1B")}${restCount > 0 ? `\uFF1B\u53E6 ${restCount} \u9879` : ""}`;
}
function makeCutPieceLineKey(line) {
  return `${line.colorName}|${line.sizeCode}|${line.partName}`;
}
function buildCuttingHandoverRecordSummary(storeRef, order, currentBatch, currentSubmittedPieceQty) {
  const previousBatches = storeRef.dispatchBatches.filter(
    (batch) => batch.dispatchOrderId === order.dispatchOrderId && batch.dispatchBatchId !== currentBatch.dispatchBatchId && Boolean(batch.handoverRecordId)
  );
  const involvedBatches = [...previousBatches, currentBatch];
  const requiredByKey = /* @__PURE__ */ new Map();
  const submittedByKey = /* @__PURE__ */ new Map();
  involvedBatches.forEach((batch) => {
    getRequiredLinesForBag(batch).forEach((line) => {
      const key = makeCutPieceLineKey(line);
      const current = requiredByKey.get(key) || {
        skuCode: `${line.colorName}-${line.sizeCode}`,
        colorName: line.colorName,
        sizeCode: line.sizeCode,
        partName: line.partName,
        requiredPieceQty: 0,
        specialCraftRequired: false,
        specialCraftStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A"
      };
      current.requiredPieceQty += line.requiredPieceQty;
      current.specialCraftRequired = current.specialCraftRequired || line.specialCraftRequired;
      if (line.specialCraftRequired && line.specialCraftReturnStatus !== "\u5DF2\u56DE\u4ED3") {
        current.specialCraftStatus = line.specialCraftReturnStatus;
      } else if (line.specialCraftRequired && current.specialCraftStatus === "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A") {
        current.specialCraftStatus = line.specialCraftReturnStatus;
      }
      requiredByKey.set(key, current);
    });
    batch.transferBagIds.forEach((bagId) => {
      const bag = findTransferBagById(storeRef, bagId);
      normalizeTransferBagRuntimeFields(bag);
      bag.pieceLines.forEach((line) => {
        const key = makeCutPieceLineKey(line);
        submittedByKey.set(key, (submittedByKey.get(key) || 0) + line.scannedPieceQty);
        if (!requiredByKey.has(key)) {
          requiredByKey.set(key, {
            skuCode: `${line.colorName}-${line.sizeCode}`,
            colorName: line.colorName,
            sizeCode: line.sizeCode,
            partName: line.partName,
            requiredPieceQty: 0,
            specialCraftRequired: line.specialCraftRequired,
            specialCraftStatus: line.specialCraftReturnStatus
          });
        }
      });
    });
  });
  const gapLines = Array.from(requiredByKey.entries()).map(([key, line]) => {
    const cumulativeSubmittedPieceQty = submittedByKey.get(key) || 0;
    const missingPieceQty = Math.max(line.requiredPieceQty - cumulativeSubmittedPieceQty, 0);
    const overPieceQty = Math.max(cumulativeSubmittedPieceQty - line.requiredPieceQty, 0);
    const hasSpecialCraftGap = line.specialCraftRequired && line.specialCraftStatus !== "\u5DF2\u56DE\u4ED3";
    const statusLabel = hasSpecialCraftGap ? line.specialCraftStatus === "\u5DEE\u5F02" ? "\u7279\u6B8A\u5DE5\u827A\u5DEE\u5F02" : line.specialCraftStatus === "\u5F02\u8BAE\u4E2D" ? "\u7279\u6B8A\u5DE5\u827A\u5F02\u8BAE\u4E2D" : "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3" : missingPieceQty > 0 ? "\u7F3A\u5C11\u88C1\u7247" : overPieceQty > 0 ? "\u88C1\u7247\u8D85\u51FA" : "";
    return {
      lineId: `CUT-GAP-${order.dispatchOrderId}-${key}`,
      skuCode: line.skuCode,
      colorName: line.colorName,
      sizeCode: line.sizeCode,
      partName: line.partName,
      requiredPieceQty: line.requiredPieceQty,
      cumulativeSubmittedPieceQty,
      missingPieceQty,
      overPieceQty,
      specialCraftRequired: line.specialCraftRequired,
      specialCraftStatus: line.specialCraftStatus,
      statusLabel
    };
  }).filter((line) => line.missingPieceQty > 0 || line.overPieceQty > 0 || line.statusLabel.includes("\u7279\u6B8A\u5DE5\u827A")).sort(
    (left, right) => `${left.colorName}-${left.sizeCode}-${left.partName}`.localeCompare(
      `${right.colorName}-${right.sizeCode}-${right.partName}`,
      "zh-CN"
    )
  );
  const previousSubmittedPieceQty = sum(previousBatches.map((batch) => getDispatchBatchPieceQty(storeRef, batch)));
  const gapPieceQtyTotal = sum(gapLines.map((line) => line.missingPieceQty));
  const overPieceQtyTotal = sum(gapLines.map((line) => line.overPieceQty));
  return {
    previousSubmittedPieceQty,
    currentSubmittedPieceQty,
    cumulativeSubmittedPieceQty: previousSubmittedPieceQty + currentSubmittedPieceQty,
    completeAfterSubmit: gapPieceQtyTotal === 0 && !gapLines.some((line) => line.statusLabel.includes("\u7279\u6B8A\u5DE5\u827A")),
    gapPieceQtyTotal,
    overPieceQtyTotal,
    gapLines
  };
}
function normalizeText(value) {
  return String(value || "").trim();
}
function makeQrValue(prefix, value) {
  return `${prefix}:${value}:\u4E8C\u7EF4\u7801`;
}
function getCuttingFactory() {
  return mockFactories.find((factory) => factory.factoryType === "CENTRAL_CUTTING") || mockFactories.find((factory) => factory.name.includes("\u88C1\u5E8A")) || mockFactories[0];
}
function getSewingFactory() {
  return mockFactories.find((factory) => factory.factoryType === "SATELLITE_SEWING") || mockFactories.find((factory) => factory.factoryType === "CENTRAL_GARMENT") || mockFactories.find((factory) => factory.name.includes("\u8F66\u7F1D")) || mockFactories[0];
}
function getProductionOrder(productionOrderId) {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId);
  if (!order) throw new Error(`\u672A\u627E\u5230\u751F\u4EA7\u5355\uFF1A${productionOrderId}`);
  return order;
}
function getTotalProductionQty(order) {
  const skuTotal = sum(order.demandSnapshot.skuLines.map((line) => line.qty || 0));
  return order.planQty || skuTotal || 0;
}
function isColorApplicable(applicableColorList, colorName) {
  if (!applicableColorList.length) return true;
  return applicableColorList.includes(colorName) || applicableColorList.includes("\u6309 SKU \u9002\u914D");
}
function mapSpecialCraftReturnStatus(feiTicketNo) {
  const specialCraftSummary = getSpecialCraftFeiTicketSummary(feiTicketNo);
  if (!specialCraftSummary.needSpecialCraft) {
    return { specialCraftRequired: false, specialCraftReturnStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A" };
  }
  if (specialCraftSummary.returnStatus.includes("\u5DF2\u56DE\u4ED3") && specialCraftSummary.currentLocation === "\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA\u4ED3" && specialCraftSummary.currentQty > 0) {
    return { specialCraftRequired: true, specialCraftReturnStatus: "\u5DF2\u56DE\u4ED3" };
  }
  if (specialCraftSummary.returnStatus === "\u5DEE\u5F02") return { specialCraftRequired: true, specialCraftReturnStatus: "\u5DEE\u5F02" };
  if (specialCraftSummary.returnStatus === "\u5F02\u8BAE\u4E2D") return { specialCraftRequired: true, specialCraftReturnStatus: "\u5F02\u8BAE\u4E2D" };
  if (specialCraftSummary.returnStatus === "\u5F85\u786E\u8BA4\u987A\u5E8F") return { specialCraftRequired: true, specialCraftReturnStatus: "\u5F85\u786E\u8BA4\u987A\u5E8F" };
  return { specialCraftRequired: true, specialCraftReturnStatus: "\u672A\u56DE\u4ED3" };
}
function getTicketQty(ticket) {
  return Math.max(ticket.qty || ticket.actualCutPieceQty || 0, 0);
}
function getTicketDispatchQty(ticket) {
  const summary = getSpecialCraftFeiTicketSummary(ticket.feiTicketNo);
  if (summary.needSpecialCraft && summary.returnStatus.includes("\u5DF2\u56DE\u4ED3")) {
    return Math.max(summary.currentQty, 0);
  }
  return getTicketQty(ticket);
}
function buildReturnedSpecialCraftFeiTicketSource(binding) {
  const qty = Math.max(binding.currentQty || binding.returnedQty || binding.qty || 0, 0);
  const issuedAt = binding.updatedAt || nowText();
  const feiTicketId = binding.feiTicketId || `SC-RET-${binding.bindingId}`;
  const pieceScope = unique([binding.colorName, binding.sizeCode, binding.partName, binding.operationName]);
  const sourceOutputLineId = `SC-RET-${binding.bindingId}`;
  const qrPayload = {
    codeType: "FEI_TICKET",
    version: "2.0.0",
    issuedAt,
    feiTicketId,
    feiTicketNo: binding.feiTicketNo,
    cutOrderId: binding.cuttingOrderId,
    cutOrderNo: binding.cuttingOrderNo,
    productionOrderId: binding.productionOrderId,
    productionOrderNo: binding.productionOrderNo,
    sourceOutputLineId,
    fabricRollId: `SC-RET-${binding.operationId}`,
    fabricRollNo: `${binding.operationName}\u56DE\u4ED3`,
    fabricColor: binding.colorName,
    materialSku: `SPECIAL-CRAFT-${binding.operationId}`,
    garmentSkuId: `${binding.colorName}-${binding.sizeCode}`,
    garmentColor: binding.colorName,
    pieceScope,
    pieceGroup: binding.partName,
    bundleScope: `${binding.colorName}-${binding.sizeCode}-${binding.partName}`,
    skuColor: binding.colorName,
    skuSize: binding.sizeCode,
    partCode: binding.partName,
    partName: binding.partName,
    bundleNo: binding.feiTicketNo,
    bundleQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange: `1-${qty}`,
    bundleTicketType: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3",
    actualCutPieceQty: qty,
    qty,
    secondaryCrafts: [binding.operationName],
    craftSequenceVersion: `${binding.operationId}:returned`,
    currentCraftStage: "\u5DF2\u56DE\u4ED3"
  };
  return {
    feiTicketId,
    feiTicketNo: binding.feiTicketNo,
    sourceOutputLineId,
    sourceSpreadingSessionId: binding.returnHandoverRecordId || binding.bindingId,
    sourceSpreadingSessionNo: binding.returnHandoverRecordNo || binding.taskOrderNo,
    sourceMarkerId: binding.workOrderId,
    sourceMarkerNo: binding.workOrderNo,
    cutOrderId: binding.cuttingOrderId,
    cutOrderNo: binding.cuttingOrderNo,
    productionOrderId: binding.productionOrderId,
    productionOrderNo: binding.productionOrderNo,
    sourceMarkerPlanId: binding.taskOrderId,
    sourceMarkerPlanNo: binding.taskOrderNo,
    fabricRollId: qrPayload.fabricRollId,
    fabricRollNo: qrPayload.fabricRollNo,
    fabricColor: binding.colorName,
    materialSku: qrPayload.materialSku,
    garmentSkuId: qrPayload.garmentSkuId,
    garmentColor: binding.colorName,
    pieceScope,
    pieceGroup: binding.partName,
    bundleScope: qrPayload.bundleScope,
    skuCode: `${binding.colorName}-${binding.sizeCode}`,
    skuColor: binding.colorName,
    skuSize: binding.sizeCode,
    partCode: binding.partName,
    partName: binding.partName,
    bundleNo: binding.feiTicketNo,
    bundleQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange: `1-${qty}`,
    bundleTicketType: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3",
    actualCutPieceQty: qty,
    printStatus: "PRINTED",
    qty,
    garmentQty: qty,
    sourceTraceCompleteness: "COMPLETE",
    secondaryCrafts: [binding.operationName],
    craftSequenceVersion: `${binding.operationId}:returned`,
    currentCraftStage: "\u5DF2\u56DE\u4ED3",
    sourceTechPackSpuCode: binding.productionOrderNo,
    sourceBasisType: "SPREADING_RESULT",
    issuedAt,
    qrPayload,
    qrValue: `SPECIAL-CRAFT-RETURN:${binding.feiTicketNo}`
  };
}
function listReturnedSpecialCraftFeiTicketSourcesForSewingDispatch() {
  const byFeiTicketNo = /* @__PURE__ */ new Map();
  listCuttingSpecialCraftFeiTicketBindingsForProjection().forEach((binding) => {
    const summary = getSpecialCraftFeiTicketSummary(binding.feiTicketNo);
    if (!summary.needSpecialCraft) return;
    if (!summary.returnStatus.includes("\u5DF2\u56DE\u4ED3")) return;
    if (summary.currentLocation !== "\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA\u4ED3") return;
    if (summary.currentQty <= 0) return;
    if (binding.specialCraftFlowStatus !== "\u5DF2\u56DE\u4ED3") return;
    const current = byFeiTicketNo.get(binding.feiTicketNo);
    if (!current || binding.updatedAt.localeCompare(current.updatedAt) >= 0) {
      byFeiTicketNo.set(binding.feiTicketNo, binding);
    }
  });
  return [...byFeiTicketNo.values()].map(buildReturnedSpecialCraftFeiTicketSource);
}
function listSewingDispatchFeiTicketSources() {
  const byNo = /* @__PURE__ */ new Map();
  listSpreadingResultGeneratedFeiTickets().forEach((ticket) => byNo.set(ticket.feiTicketNo, ticket));
  listReturnedSpecialCraftFeiTicketSourcesForSewingDispatch().forEach((ticket) => byNo.set(ticket.feiTicketNo, ticket));
  return [...byNo.values()];
}
function resolveFeiTicketForSewingDispatch(feiTicketNo) {
  return getFeiTicketByNo(feiTicketNo) || listReturnedSpecialCraftFeiTicketSourcesForSewingDispatch().find((ticket) => ticket.feiTicketNo === feiTicketNo) || null;
}
function buildContentItemFromFeiTicket(bag, ticket) {
  const summary = getSpecialCraftFeiTicketSummary(ticket.feiTicketNo);
  return {
    contentItemId: `TBCI-${bag.transferBagId}-${ticket.feiTicketNo}`,
    transferBagId: bag.transferBagId,
    dispatchBatchId: bag.dispatchBatchId,
    productionOrderId: bag.productionOrderId,
    productionOrderNo: bag.productionOrderNo,
    contentType: "\u88C1\u7247\u83F2\u7968",
    sourceKind: "FEI_TICKET",
    sourceId: ticket.feiTicketNo,
    sourceNo: ticket.feiTicketNo,
    itemName: ticket.partName || "\u88C1\u7247",
    feiTicketNo: ticket.feiTicketNo,
    partName: ticket.partName,
    colorName: ticket.garmentColor,
    sizeCode: ticket.skuSize,
    rollNo: ticket.fabricRollNo,
    qty: getTicketDispatchQty(ticket),
    currentQty: getTicketDispatchQty(ticket),
    unit: "\u7247",
    completedSpecialCraftNames: summary.completedOperationNames
  };
}
function normalizeTransferBagRuntimeFields(bag) {
  bag.bagMode = bag.bagMode || "\u6DF7\u88C5";
  bag.contentItems = bag.contentItems || [];
  bag.scannedFeiTicketNos.forEach((feiTicketNo) => {
    if (bag.contentItems.some((item) => item.sourceKind === "FEI_TICKET" && item.feiTicketNo === feiTicketNo)) return;
    const ticket = resolveFeiTicketForSewingDispatch(feiTicketNo);
    if (ticket) bag.contentItems.push(buildContentItemFromFeiTicket(bag, ticket));
  });
  bag.contentItemCount = bag.contentItems.length;
  bag.contentFeiTicketCount = bag.contentItems.filter((item) => item.sourceKind === "FEI_TICKET").length;
  bag.contentMaterialLineCount = bag.contentItems.filter((item) => item.sourceKind === "LINE_ITEM").length;
  bag.expectedBagQty = bag.expectedBagQty ?? 1;
  bag.expectedFeiTicketCount = bag.contentFeiTicketCount;
  bag.receivedFeiTicketCount = bag.receivedFeiTicketCount ?? (bag.packStatus === "\u5DF2\u626B\u7801\u63A5\u6536" || bag.status === "\u5DF2\u56DE\u5199" ? bag.contentFeiTicketCount : 0);
  bag.packStatus = bag.packStatus || (bag.status === "\u5DF2\u56DE\u5199" ? "\u5DF2\u56DE\u5199" : bag.status === "\u5DEE\u5F02" ? "\u5DEE\u5F02" : bag.status === "\u5F02\u8BAE\u4E2D" ? "\u5F02\u8BAE\u4E2D" : bag.status === "\u5DF2\u4EA4\u51FA" ? "\u5DF2\u4EA4\u51FA" : bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B");
  bag.currentLocation = bag.currentLocation || (bag.status === "\u5DF2\u56DE\u5199" ? "\u4E0B\u6E38\u5DE5\u5382\u5DF2\u63A5\u6536" : bag.status === "\u5DEE\u5F02" ? "\u5DEE\u5F02\u5F85\u5904\u7406" : bag.status === "\u5DF2\u4EA4\u51FA" ? "\u4E0B\u6E38\u5DE5\u5382\u5F85\u63A5\u6536" : "\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA");
  bag.editableBeforeHandover = bag.dispatchStatus === "\u672A\u4EA4\u51FA" && !bag.handoverSubmittedAt && !bag.receivedAt;
}
function findTransferBagById(storeRef, transferBagId) {
  const bag = storeRef.transferBags.find((item) => item.transferBagId === transferBagId);
  if (!bag) throw new Error(`\u672A\u627E\u5230\u4E2D\u8F6C\u888B\uFF1A${transferBagId}`);
  return bag;
}
function findDispatchBatchById(storeRef, dispatchBatchId) {
  const batch = storeRef.dispatchBatches.find((item) => item.dispatchBatchId === dispatchBatchId);
  if (!batch) throw new Error(`\u672A\u627E\u5230\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\uFF1A${dispatchBatchId}`);
  return batch;
}
function findDispatchOrderById(storeRef, dispatchOrderId) {
  const order = storeRef.dispatchOrders.find((item) => item.dispatchOrderId === dispatchOrderId);
  if (!order) throw new Error(`\u672A\u627E\u5230\u4EA4\u51FA\u5355\uFF1A${dispatchOrderId}`);
  return order;
}
function getOccupiedFeiTicketNos(options) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const occupied = /* @__PURE__ */ new Set();
  storeRef.transferBags.forEach((bag) => {
    if (options?.excludeBagId && bag.transferBagId === options.excludeBagId) return;
    if (bag.status === "\u5DF2\u56DE\u5199" || bag.status === "\u5DEE\u5F02" || bag.status === "\u5F02\u8BAE\u4E2D") {
      bag.scannedFeiTicketNos.forEach((feiTicketNo) => occupied.add(feiTicketNo));
      return;
    }
    if (bag.status !== "\u5F85\u88C5\u888B") {
      bag.scannedFeiTicketNos.forEach((feiTicketNo) => occupied.add(feiTicketNo));
    }
  });
  return occupied;
}
function getRequiredLinesForBag(batch) {
  const order = getProductionOrder(batch.productionOrderId);
  const snapshot = getProductionOrderTechPackSnapshot(batch.productionOrderId);
  const result = buildRequiredCutPiecesForSewingDispatch(order, snapshot, batch.plannedSkuQtyLines);
  return result.requiredPieceLines;
}
function buildPieceLineFromRequiredLine(requiredLine, bagId, index) {
  return {
    pieceLineId: `${bagId}-PIECE-${String(index + 1).padStart(3, "0")}`,
    partName: requiredLine.partName,
    colorName: requiredLine.colorName,
    colorCode: requiredLine.colorCode,
    sizeCode: requiredLine.sizeCode,
    pieceCountPerGarment: requiredLine.pieceCountPerGarment,
    garmentQty: requiredLine.garmentQty,
    requiredPieceQty: requiredLine.requiredPieceQty,
    scannedPieceQty: 0,
    scannedFeiTicketNos: [],
    missingPieceQty: requiredLine.requiredPieceQty,
    overPieceQty: 0,
    specialCraftRequired: requiredLine.specialCraftRequired,
    specialCraftReturnStatus: requiredLine.specialCraftReturnStatus,
    completeStatus: "\u6709\u7F3A\u53E3"
  };
}
function updateDispatchOrderFromChildren(order) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batches = storeRef.dispatchBatches.filter((batch) => order.dispatchBatchIds.includes(batch.dispatchBatchId));
  const bags = storeRef.transferBags.filter((bag) => order.transferBagIds.includes(bag.transferBagId));
  order.cumulativeDispatchedGarmentQty = sum(
    batches.filter((batch) => batch.status === "\u5DF2\u4EA4\u51FA" || batch.status === "\u5DF2\u56DE\u5199" || batch.status === "\u5DEE\u5F02" || batch.status === "\u5F02\u8BAE\u4E2D").map((batch) => getDispatchBatchSubmittedGarmentQty(storeRef, batch))
  );
  order.remainingGarmentQty = Math.max(order.totalProductionQty - order.cumulativeDispatchedGarmentQty, 0);
  order.feiTicketNos = unique(bags.flatMap((bag) => bag.scannedFeiTicketNos));
  order.receiverWrittenQty = sum(batches.map((batch) => batch.receiverWrittenQty || 0));
  order.differenceQty = sum(batches.map((batch) => batch.differenceQty || 0));
  order.validationStatus = batches.every((batch) => batch.completeStatus === "\u5DF2\u6838\u5BF9") ? "\u6821\u9A8C\u901A\u8FC7" : "\u6821\u9A8C\u672A\u901A\u8FC7";
  order.validationMessages = unique(
    storeRef.validationResults.filter((item) => item.dispatchOrderId === order.dispatchOrderId && item.blocking).map((item) => item.validationMessage)
  );
  if (batches.some((batch) => batch.status === "\u5F02\u8BAE\u4E2D")) order.status = "\u5F02\u8BAE\u4E2D";
  else if (batches.some((batch) => batch.status === "\u5DEE\u5F02")) order.status = "\u5DEE\u5F02";
  else if (batches.length && batches.every((batch) => batch.status === "\u5DF2\u56DE\u5199")) order.status = "\u5DF2\u56DE\u5199";
  else if (batches.some((batch) => batch.status === "\u5DF2\u4EA4\u51FA")) order.status = "\u5DF2\u4EA4\u51FA";
  else if (batches.some((batch) => batch.completeStatus === "\u5DF2\u6838\u5BF9")) order.status = "\u53EF\u4EA4\u51FA";
  else if (batches.some((batch) => batch.status === "\u88C5\u888B\u4E2D" || batch.status === "\u5F85\u88C5\u888B")) order.status = "\u5F85\u626B\u7801";
  else order.status = "\u5F85\u6838\u5BF9";
  order.updatedAt = nowText();
}
function buildRequiredCutPiecesForSewingDispatch(productionOrder, techPackSnapshot, plannedSkuQtyLines) {
  const errors = [];
  const warnings = [];
  if (!productionOrder) errors.push("\u751F\u4EA7\u5355\u7F3A\u5931");
  if (!techPackSnapshot) errors.push("\u6280\u672F\u5305\u5FEB\u7167\u7F3A\u5931");
  if (!techPackSnapshot?.cutPieceParts?.length) errors.push("\u7EB8\u6837\u88C1\u7247\u660E\u7EC6\u7F3A\u5931");
  const tickets = listReadyFeiTicketSourcesForSewingDispatch({ productionOrderId: productionOrder.productionOrderId });
  const lines = [];
  const seen = /* @__PURE__ */ new Set();
  for (const plannedLine of plannedSkuQtyLines) {
    if (plannedLine.plannedGarmentQty <= 0) {
      errors.push("\u672C\u6B21\u4EA4\u51FA\u4EF6\u6570\u5FC5\u987B\u5927\u4E8E 0");
      continue;
    }
    const sourceSkuQty = productionOrder.demandSnapshot.skuLines.filter((line) => line.color === plannedLine.colorName && line.size === plannedLine.sizeCode).reduce((total, line) => total + line.qty, 0);
    if (sourceSkuQty <= 0) {
      errors.push(`\u751F\u4EA7\u5355\u7F3A\u5C11 ${plannedLine.colorName} / ${plannedLine.sizeCode} \u6570\u91CF`);
      continue;
    }
    if (plannedLine.plannedGarmentQty > sourceSkuQty) {
      warnings.push("\u672C\u6B21\u4EA4\u51FA\u6570\u91CF\u9AD8\u4E8E\u751F\u4EA7\u5355\u9700\u6C42\u6570\u91CF\uFF0C\u8BF7\u6309\u5B9E\u9645\u88C1\u7247\u5E93\u5B58\u7EE7\u7EED\u6838\u5BF9\u7F3A\u53E3\u3002");
    }
    const ticketPartNames = new Set(
      tickets.filter((ticket) => ticket.garmentColor === plannedLine.colorName && ticket.skuSize === plannedLine.sizeCode).map((ticket) => ticket.partName)
    );
    const candidateParts = (techPackSnapshot?.cutPieceParts || []).filter((part) => !part.applicableSizeList.length || part.applicableSizeList.includes(plannedLine.sizeCode)).filter((part) => isColorApplicable(part.applicableColorList, plannedLine.colorName)).filter((part) => part.partNameCn && part.pieceCountPerGarment > 0);
    const candidatePartNames = new Set(candidateParts.map((part) => part.partNameCn));
    for (const part of candidateParts) {
      if (!ticketPartNames.has(part.partNameCn)) {
        warnings.push(`\u88C1\u7247\u90E8\u4F4D ${part.partNameCn} \u6682\u65E0\u5339\u914D\u83F2\u7968\uFF0C\u5F53\u524D\u4EA4\u51FA\u5148\u6309\u53EF\u626B\u7801\u90E8\u4F4D\u6838\u5BF9\u3002`);
        continue;
      }
      const key = `${plannedLine.colorName}|${plannedLine.sizeCode}|${part.partNameCn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sampleTicket = tickets.find(
        (ticket) => ticket.garmentColor === plannedLine.colorName && ticket.skuSize === plannedLine.sizeCode && ticket.partName === part.partNameCn
      );
      const specialCraft = sampleTicket ? mapSpecialCraftReturnStatus(sampleTicket.feiTicketNo) : { specialCraftRequired: false, specialCraftReturnStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A" };
      lines.push({
        partName: part.partNameCn,
        colorName: plannedLine.colorName,
        colorCode: plannedLine.colorCode,
        sizeCode: plannedLine.sizeCode,
        pieceCountPerGarment: part.pieceCountPerGarment,
        garmentQty: plannedLine.plannedGarmentQty,
        requiredPieceQty: plannedLine.plannedGarmentQty * part.pieceCountPerGarment,
        specialCraftRequired: specialCraft.specialCraftRequired,
        specialCraftReturnStatus: specialCraft.specialCraftReturnStatus
      });
    }
    ticketPartNames.forEach((partName) => {
      if (candidatePartNames.has(partName)) return;
      const key = `${plannedLine.colorName}|${plannedLine.sizeCode}|${partName}`;
      if (seen.has(key)) return;
      seen.add(key);
      const sampleTicket = tickets.find(
        (ticket) => ticket.garmentColor === plannedLine.colorName && ticket.skuSize === plannedLine.sizeCode && ticket.partName === partName
      );
      const specialCraft = sampleTicket ? mapSpecialCraftReturnStatus(sampleTicket.feiTicketNo) : { specialCraftRequired: false, specialCraftReturnStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A" };
      warnings.push(`\u88C1\u7247\u90E8\u4F4D ${partName} \u6765\u81EA\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u83F2\u7968\uFF0C\u6280\u672F\u5305\u672A\u914D\u7F6E\u8BE5\u90E8\u4F4D\uFF0C\u5F53\u524D\u4EA4\u51FA\u6309 1:1 \u6838\u5BF9\u3002`);
      lines.push({
        partName,
        colorName: plannedLine.colorName,
        colorCode: plannedLine.colorCode,
        sizeCode: plannedLine.sizeCode,
        pieceCountPerGarment: 1,
        garmentQty: plannedLine.plannedGarmentQty,
        requiredPieceQty: plannedLine.plannedGarmentQty,
        specialCraftRequired: specialCraft.specialCraftRequired,
        specialCraftReturnStatus: specialCraft.specialCraftReturnStatus
      });
    });
  }
  return { requiredPieceLines: lines, errors, warnings };
}
function listReadyFeiTicketSourcesForSewingDispatch(input = {}) {
  return listSewingDispatchFeiTicketSources().filter((ticket) => {
    if (input.productionOrderId && ticket.productionOrderId !== input.productionOrderId) return false;
    if (input.colorName && ticket.garmentColor !== input.colorName) return false;
    if (input.sizeCode && ticket.skuSize !== input.sizeCode) return false;
    if (input.partName && ticket.partName !== input.partName) return false;
    const specialCraft = mapSpecialCraftReturnStatus(ticket.feiTicketNo);
    if (!specialCraft.specialCraftRequired) return true;
    return specialCraft.specialCraftReturnStatus === "\u5DF2\u56DE\u4ED3";
  });
}
function listAvailableFeiTicketsForSewingDispatchInternal(input = {}) {
  const occupied = getOccupiedFeiTicketNos({ excludeBagId: input.excludeBagId });
  return listReadyFeiTicketSourcesForSewingDispatch(input).filter((ticket) => !occupied.has(ticket.feiTicketNo));
}
function getAvailablePieceQtyForSkuLine(productionOrderId, colorName, sizeCode) {
  return sum(
    listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId, colorName, sizeCode }).map((ticket) => getTicketDispatchQty(ticket))
  );
}
function getEligibleFeiTicketsForSewingDispatch(input) {
  return clone(listAvailableFeiTicketsForSewingDispatchInternal(input));
}
function listAvailableFeiTicketsForSewingDispatch(input = {}) {
  return clone(listAvailableFeiTicketsForSewingDispatchInternal(input));
}
function listAvailableCutPieceInventoryForSewingDispatch(input = {}) {
  const grouped = /* @__PURE__ */ new Map();
  listAvailableFeiTicketsForSewingDispatchInternal(input).forEach((ticket) => {
    const key = `${ticket.productionOrderId}|${ticket.garmentColor}|${ticket.skuSize}|${ticket.partName}|${ticket.materialSku}`;
    const current = grouped.get(key) || {
      productionOrderId: ticket.productionOrderId,
      productionOrderNo: ticket.productionOrderNo,
      cutOrderIds: [],
      cutOrderNos: [],
      colorName: ticket.garmentColor,
      colorCode: ticket.skuColor || ticket.garmentColor,
      sizeCode: ticket.skuSize,
      partName: ticket.partName,
      materialSku: ticket.materialSku,
      feiTicketNos: [],
      availableFeiTicketCount: 0,
      availablePieceQty: 0,
      availableGarmentQty: 0
    };
    current.cutOrderIds = unique([...current.cutOrderIds, ticket.cutOrderId]);
    current.cutOrderNos = unique([...current.cutOrderNos, ticket.cutOrderNo]);
    current.feiTicketNos = unique([...current.feiTicketNos, ticket.feiTicketNo]);
    current.availableFeiTicketCount = current.feiTicketNos.length;
    current.availablePieceQty += getTicketDispatchQty(ticket);
    current.availableGarmentQty += Math.max(ticket.garmentQty || 0, 0);
    grouped.set(key, current);
  });
  return clone([...grouped.values()].sort(
    (left, right) => `${left.productionOrderNo}-${left.colorName}-${left.sizeCode}-${left.partName}`.localeCompare(
      `${right.productionOrderNo}-${right.colorName}-${right.sizeCode}-${right.partName}`,
      "zh-CN"
    )
  ));
}
function listAvailableSkuInventoryForSewingDispatch(input = {}) {
  const grouped = /* @__PURE__ */ new Map();
  listAvailableCutPieceInventoryForSewingDispatch(input).forEach((line) => {
    const key = `${line.productionOrderId}|${line.colorName}|${line.sizeCode}`;
    const current = grouped.get(key) || {
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
      colorName: line.colorName,
      colorCode: line.colorCode,
      sizeCode: line.sizeCode,
      partNames: [],
      cutOrderNos: [],
      availableFeiTicketCount: 0,
      availablePieceQty: 0,
      availableGarmentQty: 0
    };
    current.partNames = unique([...current.partNames, line.partName]);
    current.cutOrderNos = unique([...current.cutOrderNos, ...line.cutOrderNos]);
    current.availableFeiTicketCount += line.availableFeiTicketCount;
    current.availablePieceQty += line.availablePieceQty;
    current.availableGarmentQty += line.availableGarmentQty;
    grouped.set(key, current);
  });
  return clone([...grouped.values()].sort(
    (left, right) => `${left.productionOrderNo}-${left.colorName}-${left.sizeCode}`.localeCompare(
      `${right.productionOrderNo}-${right.colorName}-${right.sizeCode}`,
      "zh-CN"
    )
  ));
}
function pickSewingAllocationReceiverFactory(color, index) {
  const candidates = mockFactories.filter(
    (factory) => factory.factoryType === "SATELLITE_SEWING" || factory.factoryType === "THIRD_SEWING" || factory.factoryType === "CENTRAL_GARMENT" || factory.name.includes("\u8F66\u7F1D")
  );
  if (color.includes("Khaki") && candidates[1]) return candidates[1];
  return candidates[index % Math.max(candidates.length, 1)] || getSewingFactory();
}
function getAllocationSpecialCraftDisplay(ticket, record) {
  if (!ticket && record?.hasSpecialCraft) return record.specialCraftDisplay || "\u7279\u6B8A\u5DE5\u827A";
  if (!ticket) return "\u65E0";
  if (!ticket.hasSpecialCraft || !ticket.specialCrafts.length) return "\u65E0";
  return unique(ticket.specialCrafts.map((craft) => craft.craftType || craft.craftName || "\u7279\u6B8A\u5DE5\u827A")).join("\u3001") || "\u7279\u6B8A\u5DE5\u827A";
}
function getAllocationSpecialCraftReceiverDisplay(ticket, record) {
  if (!ticket && record?.hasSpecialCraft) return record.receiverFactoryDisplay || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145";
  if (!ticket) return "\u65E0";
  if (!ticket.hasSpecialCraft || !ticket.specialCrafts.length) return "\u65E0";
  return unique(ticket.specialCrafts.map((craft) => craft.receiverFactoryName || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145")).join("\u3001") || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145";
}
function buildAllocationShortageItems(allocatedItems, pendingItems) {
  const shortageItems = [];
  const allocatedBySize = /* @__PURE__ */ new Map();
  allocatedItems.forEach((item) => {
    const list = allocatedBySize.get(item.size) || [];
    list.push(item);
    allocatedBySize.set(item.size, list);
  });
  pendingItems.forEach((item) => {
    shortageItems.push({
      size: allocatedItems.find((allocated) => allocated.feiTicketId === item.feiTicketId)?.size || "\u6309\u83F2\u7968\u5C3A\u7801",
      partCode: item.partName,
      partName: item.partName,
      requiredQty: item.pendingQty,
      allocatedQty: 0,
      shortageQty: item.pendingQty,
      unit: "\u7247",
      shortageReason: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3"
    });
  });
  allocatedBySize.forEach((items, size) => {
    const partNames = unique(items.map((item) => item.partName));
    if (partNames.length > 1) return;
    const allocatedQty = sum(items.map((item) => item.pieceQty));
    shortageItems.push({
      size,
      partCode: "\u5176\u4ED6\u90E8\u4F4D",
      partName: "\u5176\u4ED6\u90E8\u4F4D",
      requiredQty: allocatedQty,
      allocatedQty: 0,
      shortageQty: allocatedQty,
      unit: "\u7247",
      shortageReason: "\u5F53\u524D\u5E93\u5B58\u4EC5\u8986\u76D6\u90E8\u5206\u90E8\u4F4D\uFF0C\u5206\u914D\u540E\u7EE7\u7EED\u5C55\u793A\u7F3A\u53E3"
    });
  });
  return shortageItems;
}
function buildSewingTaskAllocationProjectionFromInventory(inventoryRecords) {
  const occupiedFeiTicketNos = getOccupiedFeiTicketNos();
  const excludedItems = [];
  const reservations = [];
  const releasedReservations = [];
  const allocatableRecords = [];
  const pendingSpecialCraftRecords = [];
  inventoryRecords.forEach((record) => {
    const ticket = resolveFeiTicketForSewingDispatch(record.feiTicketNo);
    if (record.voidStatus === "\u5DF2\u4F5C\u5E9F" || ticket?.printStatus === "VOIDED") {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: "\u83F2\u7968\u5DF2\u4F5C\u5E9F" });
      return;
    }
    if (record.printStatus === "\u672A\u9996\u6253") {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: "\u83F2\u7968\u672A\u9996\u6253" });
      return;
    }
    if (record.pieceQty <= 0) {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: "\u5E93\u5B58\u6570\u91CF\u4E3A 0" });
      return;
    }
    if (record.inventoryStatus !== "\u5F85\u5206\u914D") {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: `\u5E93\u5B58\u72B6\u6001\u4E3A${record.inventoryStatus}` });
      return;
    }
    if (occupiedFeiTicketNos.has(record.feiTicketNo)) {
      excludedItems.push({ inventoryRecordId: record.inventoryRecordId, feiTicketNo: record.feiTicketNo, exclusionReason: "\u5E93\u5B58\u5DF2\u88AB\u5176\u4ED6\u8F66\u7F1D\u4EFB\u52A1\u5360\u7528" });
      reservations.push({
        reservationId: `RES-OCCUPIED-${record.inventoryRecordId}`,
        inventoryRecordId: record.inventoryRecordId,
        sewingTaskId: "SEWING-TASK-EXISTING",
        feiTicketId: record.feiTicketId,
        reservedQty: record.pieceQty,
        unit: "\u7247",
        reservedAt: "2026-05-20 10:00:00",
        reservedBy: "\u88C1\u7247\u4ED3\u5206\u914D\u5458",
        reservationStatus: "\u5DF2\u5360\u7528"
      });
      return;
    }
    const mappedSpecialCraft = ticket ? mapSpecialCraftReturnStatus(record.feiTicketNo) : { specialCraftRequired: false, specialCraftReturnStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A" };
    const specialCraft = {
      specialCraftRequired: mappedSpecialCraft.specialCraftRequired || Boolean(record.hasSpecialCraft),
      specialCraftReturnStatus: mappedSpecialCraft.specialCraftRequired ? mappedSpecialCraft.specialCraftReturnStatus : record.hasSpecialCraft ? "\u672A\u56DE\u4ED3" : mappedSpecialCraft.specialCraftReturnStatus
    };
    if (specialCraft.specialCraftRequired && specialCraft.specialCraftReturnStatus !== "\u5DF2\u56DE\u4ED3") {
      pendingSpecialCraftRecords.push({ record, ticket, specialCraft });
      return;
    }
    allocatableRecords.push({ record, ticket, specialCraft });
  });
  if (allocatableRecords[0]) {
    releasedReservations.push({
      reservationId: `RES-RELEASED-${allocatableRecords[0].record.inventoryRecordId}`,
      inventoryRecordId: allocatableRecords[0].record.inventoryRecordId,
      sewingTaskId: "SEWING-TASK-CANCELLED-001",
      feiTicketId: allocatableRecords[0].record.feiTicketId,
      reservedQty: allocatableRecords[0].record.pieceQty,
      unit: "\u7247",
      reservedAt: "2026-05-21 15:30:00",
      reservedBy: "\u88C1\u7247\u4ED3\u5206\u914D\u5458",
      reservationStatus: "\u5DF2\u91CA\u653E"
    });
  }
  const grouped = /* @__PURE__ */ new Map();
  allocatableRecords.forEach((entry) => {
    const key = `${entry.record.productionOrderId}|${entry.record.spuCode || entry.ticket?.sourceTechPackSpuCode || entry.ticket?.skuCode}|${entry.record.color}`;
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  });
  const globalSpecialCraftPendingItems = pendingSpecialCraftRecords.map(({ record, ticket, specialCraft }) => ({
    feiTicketId: record.feiTicketId,
    feiTicketNo: record.feiTicketNo,
    partName: record.partName || ticket?.partName || "\u672A\u6807\u8BB0\u90E8\u4F4D",
    specialCraftType: getAllocationSpecialCraftDisplay(ticket, record),
    receiverFactoryName: getAllocationSpecialCraftReceiverDisplay(ticket, record),
    expectedReturnStatus: specialCraft.specialCraftReturnStatus,
    pendingQty: record.pieceQty
  }));
  const allocations = [...grouped.values()].map((entries, index) => {
    const first = entries[0];
    const receiverFactory = pickSewingAllocationReceiverFactory(first.record.color || first.ticket?.garmentColor || "", index);
    const allocatedItems = entries.map(({ record, ticket, specialCraft }) => ({
      allocationItemId: `ALLOC-ITEM-${record.inventoryRecordId}`,
      feiTicketId: record.feiTicketId,
      feiTicketNo: record.feiTicketNo,
      inventoryRecordId: record.inventoryRecordId,
      productionOrderNo: ticket?.productionOrderNo || record.productionOrderNo || record.productionOrderId,
      cutOrderNo: ticket?.cutOrderNo || record.cutOrderNo || record.cutOrderId,
      size: record.size || ticket?.skuSize || "\u672A\u6807\u8BB0",
      partCode: ticket?.partCode || record.partName,
      partName: record.partName || ticket?.partName || "\u672A\u6807\u8BB0\u90E8\u4F4D",
      pieceQty: record.pieceQty,
      pieceSequenceLabel: record.pieceSequenceLabel || ticket?.pieceSequenceLabel || "\u6309\u83F2\u7968\u8FFD\u8E2A",
      tempBagCode: record.tempBagCode,
      inventoryLocation: `${record.warehouseArea}/${record.locationCode}`,
      hasSpecialCraft: specialCraft.specialCraftRequired,
      specialCraftReturnStatus: specialCraft.specialCraftReturnStatus
    }));
    const relatedPendingItems = pendingSpecialCraftRecords.filter(({ record }) => record.productionOrderId === first.record.productionOrderId && record.color === first.record.color).map(({ record, ticket, specialCraft }) => ({
      feiTicketId: record.feiTicketId,
      feiTicketNo: record.feiTicketNo,
      partName: record.partName || ticket?.partName || "\u672A\u6807\u8BB0\u90E8\u4F4D",
      specialCraftType: getAllocationSpecialCraftDisplay(ticket, record),
      receiverFactoryName: getAllocationSpecialCraftReceiverDisplay(ticket, record),
      expectedReturnStatus: specialCraft.specialCraftReturnStatus,
      pendingQty: record.pieceQty
    }));
    const allocationId = `SEW-ALLOC-${first.record.productionOrderId}-${first.record.color || "COLOR"}-${String(index + 1).padStart(2, "0")}`;
    const allocationReservations = allocatedItems.map((item) => {
      const reservation = {
        reservationId: `RES-${allocationId}-${item.inventoryRecordId}`,
        inventoryRecordId: item.inventoryRecordId,
        sewingTaskId: allocationId,
        feiTicketId: item.feiTicketId,
        reservedQty: item.pieceQty,
        unit: "\u7247",
        reservedAt: "2026-05-23 09:20:00",
        reservedBy: "\u88C1\u7247\u4ED3\u5206\u914D\u5458",
        reservationStatus: "\u6709\u6548"
      };
      reservations.push(reservation);
      return reservation;
    });
    const shortageItems = buildAllocationShortageItems(allocatedItems, relatedPendingItems);
    return {
      sewingTaskId: allocationId,
      sewingTaskNo: `CFRW-${first.ticket?.productionOrderNo || first.record.productionOrderNo || first.record.productionOrderId}-${String(index + 1).padStart(2, "0")}`,
      sourceType: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58",
      sourceWarehouseId: "cutting-wait-handover",
      sourceWarehouseName: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
      productionOrderIds: unique(entries.map((entry) => entry.record.productionOrderId)),
      cutOrderIds: unique(entries.map((entry) => entry.record.cutOrderId)),
      spuCode: first.record.spuCode || first.ticket?.sourceTechPackSpuCode || first.ticket?.skuCode || "\u672A\u5173\u8054 SPU",
      styleName: first.ticket?.sourceTechPackSpuCode || first.ticket?.skuCode || first.record.spuCode || "\u672A\u5173\u8054\u6B3E\u5F0F",
      color: first.record.color || first.ticket?.garmentColor || "\u672A\u6807\u8BB0\u989C\u8272",
      receiverFactoryId: receiverFactory.id,
      receiverFactoryCode: receiverFactory.code || receiverFactory.id,
      receiverFactoryName: receiverFactory.name.includes("\u8F66\u7F1D") ? receiverFactory.name : `${receiverFactory.name}\u8F66\u7F1D\u5382`,
      allocationBasis: "\u57FA\u4E8E\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5DF2\u6709\u83F2\u7968 / \u88C1\u7247\u5E93\u5B58",
      allocationStatus: "\u5019\u9009",
      allocatedItems,
      shortageItems,
      specialCraftPendingItems: relatedPendingItems,
      inventoryReservationIds: allocationReservations.map((reservation) => reservation.reservationId),
      createdAt: "2026-05-23 09:20:00",
      createdBy: "\u88C1\u7247\u4ED3\u5206\u914D\u5458",
      remark: "\u4E0D\u9F50\u5957\u4E5F\u53EF\u751F\u6210\u8F66\u7F1D\u4EFB\u52A1\u5019\u9009\uFF1B\u7F3A\u53E3\u5728\u5206\u914D\u7ED3\u679C\u4E2D\u5C55\u793A\u3002"
    };
  });
  const availablePieceQty = allocations.reduce((total, allocation) => total + sum(allocation.allocatedItems.map((item) => item.pieceQty)), 0);
  const reservedPieceQty = reservations.filter((reservation) => reservation.reservationStatus !== "\u5DF2\u91CA\u653E").reduce((total, reservation) => total + reservation.reservedQty, 0);
  return {
    allocations,
    reservations,
    releasedReservations,
    excludedItems,
    specialCraftPendingItems: globalSpecialCraftPendingItems,
    availableInventoryCount: allocations.reduce((total, allocation) => total + allocation.allocatedItems.length, 0),
    availablePieceQty,
    reservedInventoryCount: reservations.filter((reservation) => reservation.reservationStatus !== "\u5DF2\u91CA\u653E").length,
    reservedPieceQty,
    shortageCount: allocations.reduce((total, allocation) => total + allocation.shortageItems.length, 0),
    specialCraftPendingCount: pendingSpecialCraftRecords.length,
    cancelledAllocationCount: releasedReservations.length,
    ruleNotes: [
      "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u53EA\u8BFB\u53D6\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5DF2\u5165\u4ED3\u83F2\u7968 / \u88C1\u7247\u5E93\u5B58\u3002",
      "\u672A\u5165\u4ED3\u83F2\u7968\u4E0D\u53C2\u4E0E\u5206\u914D\uFF1B\u5DF2\u4F5C\u5E9F\u83F2\u7968\u4E0D\u53C2\u4E0E\u5206\u914D\u3002",
      "\u4E0D\u9F50\u5957\u4E5F\u53EF\u4EE5\u751F\u6210\u8F66\u7F1D\u4EFB\u52A1\u5019\u9009\uFF0C\u5206\u914D\u540E\u7F3A\u53E3\u4F5C\u4E3A\u7ED3\u679C\u5C55\u793A\u3002",
      "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u7684\u90E8\u4F4D\u6682\u4E0D\u53C2\u4E0E\u672C\u6B21\u53EF\u5206\u914D\u5E93\u5B58\uFF0C\u5176\u4ED6\u90E8\u4F4D\u4ECD\u53EF\u5206\u914D\u3002",
      "\u5E93\u5B58\u5360\u7528\u4E0D\u7B49\u4E8E\u4EA4\u51FA\uFF1B\u4EA4\u51FA\u5355\u548C\u4EA4\u51FA\u8BB0\u5F55\u7559\u7ED9\u540E\u7EED\u6D41\u7A0B\u3002"
    ]
  };
}
function buildPickingRequiredItems(allocation) {
  const rows = /* @__PURE__ */ new Map();
  const append = (input) => {
    const key = `${input.size}|${input.partCode}|${input.partName}`;
    const current = rows.get(key);
    if (current) {
      current.requiredQty += input.qty;
      return;
    }
    rows.set(key, {
      size: input.size,
      partCode: input.partCode,
      partName: input.partName,
      requiredQty: input.qty,
      unit: "\u7247"
    });
  };
  allocation.allocatedItems.forEach((item) => {
    append({
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      qty: item.pieceQty
    });
  });
  allocation.shortageItems.forEach((item) => {
    append({
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      qty: item.shortageQty
    });
  });
  return [...rows.values()];
}
function buildPickingShortageItems(requiredItems, pickedItems) {
  return requiredItems.map((item) => {
    const pickedQty = sum(
      pickedItems.filter((picked) => picked.checkResult === "\u901A\u8FC7" && picked.feiTicketNo && picked.sourceTempBagCode).filter((picked) => picked.size === item.size && picked.partCode === item.partCode && picked.partName === item.partName).map((picked) => picked.pickedQty)
    );
    const shortageQty = Math.max(0, item.requiredQty - pickedQty);
    return {
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      requiredQty: item.requiredQty,
      pickedQty,
      shortageQty,
      shortageReason: shortageQty > 0 ? "\u672C\u6B21\u90E8\u5206\u5206\u62E3\uFF0C\u7F3A\u53E3\u7EE7\u7EED\u5C55\u793A" : "\u5DF2\u5206\u62E3"
    };
  }).filter((item) => item.shortageQty > 0);
}
function buildPickingTempBagSources(items) {
  const byBag = /* @__PURE__ */ new Map();
  items.forEach((item) => {
    const current = byBag.get(item.tempBagCode) || {
      tempBagCode: item.tempBagCode,
      feiTicketCount: 0,
      pieceQty: 0,
      locationCode: item.locationCode
    };
    current.feiTicketCount += 1;
    current.pieceQty += item.pieceQty;
    byBag.set(item.tempBagCode, current);
  });
  return [...byBag.values()];
}
function buildTargetTransferBagUse(allocation, pickingTaskId, bagCode, items, sequence) {
  return {
    bagUseId: `TB-USE-${pickingTaskId}-${String(sequence).padStart(2, "0")}`,
    bagCode,
    bagMasterId: `carrier-${bagCode.toLowerCase()}`,
    useStage: "\u4EA4\u51FA\u88C5\u888B",
    sewingTaskId: allocation.sewingTaskId,
    sewingTaskNo: allocation.sewingTaskNo,
    pickingTaskId,
    containedFeiTickets: items.map((item) => ({
      feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo,
      pieceQty: item.pickedQty
    })),
    totalPieceQty: sum(items.map((item) => item.pickedQty)),
    packedAt: items[0]?.scannedAt || "2026-05-23 11:00:00",
    packedBy: items[0]?.scannedBy || "\u88C1\u7247\u4ED3\u5206\u62E3\u5458",
    bagStatus: items.length ? "\u5DF2\u88C5\u888B\u5F85\u4EA4\u51FA" : "\u88C5\u888B\u4E2D"
  };
}
function buildPickedItemsForAllocation(allocation, allocatedInventoryItems, allocationIndex) {
  const selectedItems = allocationIndex === 0 ? allocatedInventoryItems.slice(0, 1) : allocatedInventoryItems;
  return selectedItems.map((item, index) => ({
    feiTicketId: item.feiTicketId,
    feiTicketNo: item.feiTicketNo,
    scannedAt: `2026-05-23 11:${String(10 + allocationIndex * 10 + index).padStart(2, "0")}:00`,
    scannedBy: "\u88C1\u7247\u4ED3\u5206\u62E3\u5458",
    sourceTempBagCode: item.tempBagCode,
    targetTransferBagCode: allocationIndex === 0 ? "BAG-PICK-001" : index % 2 === 0 ? "BAG-PICK-002" : "BAG-PICK-003",
    size: item.size,
    partCode: item.partCode,
    partName: item.partName,
    pickedQty: item.pieceQty,
    checkResult: "\u901A\u8FC7"
  }));
}
function buildTargetBagsForPickingTask(allocation, pickingTaskId, pickedItems) {
  const byBag = /* @__PURE__ */ new Map();
  pickedItems.forEach((item) => {
    const rows = byBag.get(item.targetTransferBagCode) || [];
    rows.push(item);
    byBag.set(item.targetTransferBagCode, rows);
  });
  return [...byBag.entries()].map(
    ([bagCode, items], index) => buildTargetTransferBagUse(allocation, pickingTaskId, bagCode, items, index + 1)
  );
}
function buildPickingScanChecks(tasks, projection) {
  const firstTask = tasks[0];
  const secondTask = tasks[1];
  const firstPicked = firstTask?.pickedItems[0];
  const firstAllocated = firstTask?.allocatedInventoryItems[0];
  const secondAllocated = secondTask?.allocatedInventoryItems[0];
  const pendingSpecialCraft = projection.specialCraftPendingItems[0];
  const checks = [];
  if (firstTask) {
    checks.push(
      {
        checkId: "PICK-CHECK-TASK-OK",
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: "\u914D\u6599\u4EFB\u52A1\u7801",
        scannedValue: firstTask.pickingTaskNo,
        checkResult: "\u901A\u8FC7",
        reason: "\u5DF2\u8FDB\u5165\u5F53\u524D\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599\u4EFB\u52A1",
        syncStatus: "\u5DF2\u540C\u6B65"
      },
      {
        checkId: "PICK-CHECK-SOURCE-BAG-OK",
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: "\u6765\u6E90\u5165\u4ED3\u6682\u5B58\u888B",
        scannedValue: firstTask.tempBagSources[0]?.tempBagCode || "BAG-B-003",
        checkResult: "\u901A\u8FC7",
        reason: "\u6765\u6E90\u888B\u5185\u5B58\u5728\u5F53\u524D\u4EFB\u52A1\u5DF2\u5206\u914D\u83F2\u7968",
        syncStatus: "\u5DF2\u540C\u6B65"
      }
    );
  }
  if (firstAllocated && firstTask) {
    checks.push({
      checkId: "PICK-CHECK-FEI-OK",
      pickingTaskNo: firstTask.pickingTaskNo,
      scanObject: "\u83F2\u7968",
      scannedValue: firstAllocated.feiTicketNo,
      checkResult: "\u901A\u8FC7",
      reason: "\u83F2\u7968\u5C5E\u4E8E\u5F53\u524D\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u7ED3\u679C",
      syncStatus: "\u5DF2\u540C\u6B65"
    });
  }
  if (secondAllocated && firstTask) {
    checks.push({
      checkId: "PICK-CHECK-FEI-WRONG-TASK",
      pickingTaskNo: firstTask.pickingTaskNo,
      scanObject: "\u83F2\u7968",
      scannedValue: secondAllocated.feiTicketNo,
      checkResult: "\u62D2\u7EDD",
      reason: "\u83F2\u7968\u4E0D\u5C5E\u4E8E\u5F53\u524D\u914D\u6599\u4EFB\u52A1",
      syncStatus: "\u5DF2\u540C\u6B65"
    });
  }
  if (firstTask) {
    checks.push(
      {
        checkId: "PICK-CHECK-FEI-VOID",
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: "\u83F2\u7968",
        scannedValue: "FT-VOID-PICKING-DEMO",
        checkResult: "\u62D2\u7EDD",
        reason: "\u4F5C\u5E9F\u83F2\u7968\u4E0D\u80FD\u5206\u62E3",
        syncStatus: "\u5DF2\u540C\u6B65"
      },
      {
        checkId: "PICK-CHECK-BAG-CONFLICT",
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: "\u76EE\u6807\u4E2D\u8F6C\u888B",
        scannedValue: "BAG-PICK-LOCKED-001",
        checkResult: "\u62D2\u7EDD",
        reason: "\u76EE\u6807\u4E2D\u8F6C\u888B\u5DF2\u7ED1\u5B9A\u5176\u4ED6\u8F66\u7F1D\u4EFB\u52A1",
        syncStatus: "\u5DF2\u540C\u6B65"
      },
      {
        checkId: "PICK-CHECK-FEI-OTHER-PICKED",
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: "\u83F2\u7968",
        scannedValue: "FT-OTHER-TASK-PICKED-DEMO",
        checkResult: "\u62D2\u7EDD",
        reason: "\u83F2\u7968\u5DF2\u88AB\u5176\u4ED6\u914D\u6599\u4EFB\u52A1\u5206\u62E3",
        syncStatus: "\u5DF2\u540C\u6B65"
      }
    );
  }
  if (pendingSpecialCraft && firstTask) {
    checks.push({
      checkId: "PICK-CHECK-SPECIAL-PENDING",
      pickingTaskNo: firstTask.pickingTaskNo,
      scanObject: "\u83F2\u7968",
      scannedValue: pendingSpecialCraft.feiTicketNo || pendingSpecialCraft.feiTicketId,
      checkResult: "\u62D2\u7EDD",
      reason: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\uFF0C\u6682\u4E0D\u5206\u62E3\u7ED9\u8F66\u7F1D\u4EFB\u52A1",
      syncStatus: "\u5DF2\u540C\u6B65"
    });
  }
  if (firstPicked && firstTask) {
    checks.push(
      {
        checkId: "PICK-CHECK-DUPLICATE",
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: "\u83F2\u7968",
        scannedValue: firstPicked.feiTicketNo,
        checkResult: "\u63D0\u793A",
        reason: "\u83F2\u7968\u5DF2\u5728\u5F53\u524D\u4EFB\u52A1\u5B8C\u6210\u5206\u62E3\uFF0C\u907F\u514D\u91CD\u590D\u5206\u62E3",
        syncStatus: "\u5DF2\u540C\u6B65"
      },
      {
        checkId: "PICK-CHECK-SYNC-FAILED",
        pickingTaskNo: firstTask.pickingTaskNo,
        scanObject: "\u76EE\u6807\u4E2D\u8F6C\u888B",
        scannedValue: firstPicked.targetTransferBagCode,
        checkResult: "\u63D0\u793A",
        reason: "PDA \u5206\u62E3\u63D0\u4EA4\u5DF2\u8BB0\u5F55\uFF0C\u7B49\u5F85\u91CD\u65B0\u540C\u6B65",
        syncStatus: "\u540C\u6B65\u5931\u8D25"
      }
    );
  }
  return checks;
}
function buildHandoverPickingTaskProjectionFromAllocationProjection(allocationProjection) {
  const tasks = allocationProjection.allocations.map((allocation, index) => {
    const pickingTaskId = `PICK-${allocation.sewingTaskId}`;
    const requiredItems = buildPickingRequiredItems(allocation);
    const allocatedInventoryItems = allocation.allocatedItems.map((item) => ({
      inventoryRecordId: item.inventoryRecordId,
      feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo,
      tempBagCode: item.tempBagCode,
      locationCode: item.inventoryLocation,
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      pieceQty: item.pieceQty,
      pieceSequenceLabel: item.pieceSequenceLabel,
      specialCraftReturnStatus: item.specialCraftReturnStatus
    }));
    const pickedItems = buildPickedItemsForAllocation(allocation, allocatedInventoryItems, index);
    const shortageItems = buildPickingShortageItems(requiredItems, pickedItems);
    const targetTransferBags2 = buildTargetBagsForPickingTask(allocation, pickingTaskId, pickedItems);
    const taskStatus = targetTransferBags2.length > 1 && shortageItems.length === 0 ? "\u5DF2\u88C5\u888B\u5F85\u4EA4\u51FA" : pickedItems.length > 0 ? "\u5206\u62E3\u4E2D" : "\u5F85\u5206\u62E3";
    return {
      pickingTaskId,
      pickingTaskNo: `CPT-${allocation.sewingTaskNo}`,
      sewingTaskId: allocation.sewingTaskId,
      sewingTaskNo: allocation.sewingTaskNo,
      receiverFactoryId: allocation.receiverFactoryId,
      receiverFactoryCode: allocation.receiverFactoryCode,
      receiverFactoryName: allocation.receiverFactoryName,
      sourceWarehouseId: allocation.sourceWarehouseId,
      sourceWarehouseName: allocation.sourceWarehouseName,
      taskStatus,
      requiredItems,
      allocatedInventoryItems,
      pickedItems,
      shortageItems,
      tempBagSources: buildPickingTempBagSources(allocatedInventoryItems),
      targetTransferBags: targetTransferBags2,
      createdAt: allocation.createdAt,
      createdBy: allocation.createdBy,
      updatedAt: index === 0 ? "2026-05-23 11:18:00" : "2026-05-23 11:38:00"
    };
  });
  const targetTransferBags = tasks.flatMap((task) => task.targetTransferBags);
  const scanChecks = buildPickingScanChecks(tasks, allocationProjection);
  return {
    tasks,
    targetTransferBags,
    scanChecks,
    taskCount: tasks.length,
    pendingCount: tasks.filter((task) => task.taskStatus === "\u5F85\u5206\u62E3").length,
    sortingCount: tasks.filter((task) => task.taskStatus === "\u5206\u62E3\u4E2D" || task.taskStatus === "\u5DF2\u5206\u62E3\u5F85\u88C5\u888B").length,
    packedCount: tasks.filter((task) => task.taskStatus === "\u5DF2\u88C5\u888B\u5F85\u4EA4\u51FA").length,
    shortageCount: tasks.reduce((total, task) => total + task.shortageItems.length, 0),
    targetTransferBagCount: targetTransferBags.length,
    syncFailedCount: scanChecks.filter((check) => check.syncStatus === "\u540C\u6B65\u5931\u8D25").length,
    ruleNotes: [
      "\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599\u53EA\u4ECE\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u540E\u7684\u83F2\u7968 / \u88C1\u7247\u5E93\u5B58\u62E3\u9009\u3002",
      "\u8FD9\u91CC\u662F\u88C1\u7247\u914D\u6599\uFF0C\u4E0D\u662F\u524D\u6BB5\u4E2D\u8F6C\u4ED3\u7ED9\u88C1\u5E8A\u51C6\u5907\u9762\u6599\u3002",
      "\u5165\u4ED3\u6682\u5B58\u888B\u53EF\u6DF7\u88C5\uFF1B\u4E8C\u6B21\u5206\u62E3\u5F00\u59CB\u6309\u8F66\u7F1D\u4EFB\u52A1\u7EC4\u7EC7\u88C1\u7247\u3002",
      "\u4EA4\u51FA\u88C5\u888B\u9636\u6BB5\u4E00\u4E2A\u4E2D\u8F6C\u888B\u53EA\u5BF9\u5E94\u4E00\u4E2A\u8F66\u7F1D\u4EFB\u52A1\uFF0C\u4E00\u4E2A\u8F66\u7F1D\u4EFB\u52A1\u53EF\u5BF9\u5E94\u591A\u4E2A\u4E2D\u8F6C\u888B\u3002",
      "\u5141\u8BB8\u90E8\u5206\u5206\u62E3\u63D0\u4EA4\uFF0C\u7F3A\u53E3\u4F5C\u4E3A\u5206\u62E3\u7ED3\u679C\u5C55\u793A\u3002"
    ]
  };
}
function createCuttingSewingDispatchOrder(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const productionOrder = getProductionOrder(input.productionOrderId);
  const cuttingFactory = input.cuttingFactoryId ? mockFactories.find((factory) => factory.id === input.cuttingFactoryId) || getCuttingFactory() : getCuttingFactory();
  const sewingFactory = input.sewingFactoryId ? mockFactories.find((factory) => factory.id === input.sewingFactoryId) || getSewingFactory() : getSewingFactory();
  const tickets = listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId: productionOrder.productionOrderId });
  if (!tickets.length) throw new Error("\u5F53\u524D\u751F\u4EA7\u5355\u6682\u65E0\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u83F2\u7968\u5E93\u5B58\uFF0C\u4E0D\u80FD\u5206\u914D\u8F66\u7F1D\u4EFB\u52A1");
  const dispatchIndex = storeRef.dispatchOrders.length + 1;
  const createdAt = nowText();
  const order = {
    dispatchOrderId: `CSDO-${productionOrder.productionOrderId}-${String(dispatchIndex).padStart(2, "0")}`,
    dispatchOrderNo: `CPFL-${productionOrder.productionOrderNo}-${String(dispatchIndex).padStart(2, "0")}`,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    cuttingOrderIds: unique(tickets.map((ticket) => ticket.cutOrderId)),
    cuttingOrderNos: unique(tickets.map((ticket) => ticket.cutOrderNo)),
    cuttingFactoryId: cuttingFactory.id,
    cuttingFactoryName: cuttingFactory.name,
    sewingFactoryId: sewingFactory.id,
    sewingFactoryName: sewingFactory.name.includes("\u8F66\u7F1D") ? sewingFactory.name : `${sewingFactory.name}\u8F66\u7F1D\u5382`,
    totalProductionQty: getTotalProductionQty(productionOrder),
    plannedDispatchGarmentQty: 0,
    cumulativeDispatchedGarmentQty: 0,
    remainingGarmentQty: getTotalProductionQty(productionOrder),
    dispatchBatchIds: [],
    transferOrderIds: [],
    transferBagIds: [],
    feiTicketNos: [],
    handoverRecordIds: [],
    status: "\u8349\u7A3F",
    validationStatus: "\u672A\u6821\u9A8C",
    validationMessages: [],
    createdAt,
    updatedAt: createdAt,
    remark: input.remark
  };
  storeRef.dispatchOrders.push(order);
  return clone(order);
}
function createCuttingSewingDispatchBatch(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const order = findDispatchOrderById(storeRef, input.dispatchOrderId);
  const normalizedLines = input.plannedSkuQtyLines.filter((line) => line.plannedGarmentQty > 0).map((line, index) => ({
    lineId: `${input.dispatchOrderId}-SKU-${String(index + 1).padStart(3, "0")}`,
    colorName: line.colorName,
    colorCode: line.colorCode || line.colorName,
    sizeCode: line.sizeCode,
    plannedGarmentQty: line.plannedGarmentQty,
    dispatchedGarmentQty: 0,
    remainingGarmentQty: getAvailablePieceQtyForSkuLine(order.productionOrderId, line.colorName, line.sizeCode)
  }));
  if (!normalizedLines.length) throw new Error("\u81F3\u5C11\u9700\u8981\u4E00\u884C\u672C\u6B21\u4EA4\u51FA\u989C\u8272 / \u5C3A\u7801 / \u4EF6\u6570");
  const noStockLine = normalizedLines.find((line) => line.remainingGarmentQty <= 0);
  if (noStockLine) throw new Error(`\u5F85\u4EA4\u51FA\u4ED3\u6CA1\u6709 ${noStockLine.colorName} / ${noStockLine.sizeCode} \u7684\u53EF\u5206\u914D\u83F2\u7968\uFF0C\u4E0D\u80FD\u521B\u5EFA\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D`);
  const overStockLine = normalizedLines.find((line) => line.plannedGarmentQty > line.remainingGarmentQty);
  if (overStockLine) throw new Error(`\u672C\u6B21\u5206\u914D\u6570\u91CF\u8D85\u8FC7\u5F85\u4EA4\u51FA\u4ED3 ${overStockLine.colorName} / ${overStockLine.sizeCode} \u53EF\u7528\u88C1\u7247\u6570\u91CF`);
  const batchIndex = storeRef.dispatchBatches.filter((batch2) => batch2.productionOrderId === order.productionOrderId).length + 1;
  const createdAt = nowText();
  const batch = {
    dispatchBatchId: `CSDB-${order.productionOrderId}-${String(batchIndex).padStart(2, "0")}`,
    dispatchBatchNo: `PC-${order.productionOrderNo}-${String(batchIndex).padStart(2, "0")}`,
    dispatchOrderId: order.dispatchOrderId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    transferOrderId: `CTO-${order.productionOrderId}-${String(batchIndex).padStart(2, "0")}`,
    transferOrderNo: `ZZD-${order.productionOrderNo}-${String(batchIndex).padStart(2, "0")}`,
    transferOrderQrValue: makeQrValue("CUT-SEW-TRANSFER-ORDER", `${order.productionOrderNo}-${batchIndex}`),
    plannedGarmentQty: sum(normalizedLines.map((line) => line.plannedGarmentQty)),
    plannedSkuQtyLines: normalizedLines,
    transferBagIds: [],
    feiTicketNos: [],
    completeStatus: "\u672A\u6821\u9A8C",
    status: "\u5F85\u88C5\u888B",
    createdAt,
    updatedAt: createdAt
  };
  storeRef.dispatchBatches.push(batch);
  order.currentBatchId = batch.dispatchBatchId;
  order.dispatchBatchIds.push(batch.dispatchBatchId);
  order.transferOrderIds.push(batch.transferOrderId);
  order.plannedDispatchGarmentQty += batch.plannedGarmentQty;
  order.status = "\u5F85\u626B\u7801";
  order.updatedAt = createdAt;
  return clone(batch);
}
function createCuttingSewingTransferBags(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = findDispatchBatchById(storeRef, input.dispatchBatchId);
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId);
  const requiredLines = getRequiredLinesForBag(batch);
  const noStockLine = input.bagPlanList.flatMap((plan) => plan.skuQtyLines).find((line) => getAvailablePieceQtyForSkuLine(order.productionOrderId, line.colorName, line.sizeCode) <= 0);
  if (noStockLine) throw new Error(`\u5F85\u4EA4\u51FA\u4ED3\u6CA1\u6709 ${noStockLine.colorName} / ${noStockLine.sizeCode} \u7684\u53EF\u88C5\u888B\u83F2\u7968`);
  const createdAt = nowText();
  const created = input.bagPlanList.map((plan, index) => {
    const bagSequence = batch.transferBagIds.length + index + 1;
    const bagId = `CSTB-${batch.dispatchBatchId}-${String(bagSequence).padStart(2, "0")}`;
    const pieceLines = requiredLines.filter((line) => plan.skuQtyLines.some((skuLine) => skuLine.colorName === line.colorName && skuLine.sizeCode === line.sizeCode)).map((line, lineIndex) => buildPieceLineFromRequiredLine(line, bagId, lineIndex));
    const bag = {
      transferBagId: bagId,
      transferBagNo: `ZZD-BAG-${batch.transferOrderNo}-${String(bagSequence).padStart(2, "0")}`,
      transferBagQrValue: makeQrValue("CUT-SEW-TRANSFER-BAG", `${batch.transferOrderNo}-${bagSequence}`),
      dispatchOrderId: order.dispatchOrderId,
      dispatchBatchId: batch.dispatchBatchId,
      transferOrderId: batch.transferOrderId,
      transferOrderNo: batch.transferOrderNo,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      cuttingOrderIds: [...order.cuttingOrderIds],
      cuttingOrderNos: [...order.cuttingOrderNos],
      sewingFactoryId: order.sewingFactoryId,
      sewingFactoryName: order.sewingFactoryName,
      bagSequence,
      plannedGarmentQty: plan.plannedGarmentQty,
      bagMode: "\u6DF7\u88C5",
      skuQtyLines: plan.skuQtyLines.map((line) => ({ ...line })),
      pieceLines,
      scannedFeiTicketNos: [],
      contentItems: [],
      contentItemCount: 0,
      contentFeiTicketCount: 0,
      contentMaterialLineCount: 0,
      completeStatus: "\u672A\u6821\u9A8C",
      dispatchStatus: "\u672A\u4EA4\u51FA",
      packStatus: "\u5F85\u88C5\u888B",
      currentLocation: "\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA",
      editableBeforeHandover: true,
      expectedBagQty: 1,
      expectedFeiTicketCount: 0,
      receivedFeiTicketCount: 0,
      status: "\u5F85\u88C5\u888B",
      createdAt,
      updatedAt: createdAt
    };
    normalizeTransferBagRuntimeFields(bag);
    return bag;
  });
  created.forEach((bag) => {
    storeRef.transferBags.push(bag);
    batch.transferBagIds.push(bag.transferBagId);
    order.transferBagIds.push(bag.transferBagId);
  });
  batch.status = "\u5F85\u88C5\u888B";
  batch.updatedAt = createdAt;
  order.status = "\u5F85\u626B\u7801";
  order.updatedAt = createdAt;
  return clone(created);
}
function createOrGetTransferBagForDispatchBatch(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = findDispatchBatchById(storeRef, input.dispatchBatchId);
  const editableBag = storeRef.transferBags.find(
    (bag2) => bag2.dispatchBatchId === batch.dispatchBatchId && bag2.dispatchStatus === "\u672A\u4EA4\u51FA"
  );
  if (editableBag) {
    normalizeTransferBagRuntimeFields(editableBag);
    return clone(editableBag);
  }
  const created = createCuttingSewingTransferBags({
    dispatchBatchId: batch.dispatchBatchId,
    bagPlanList: [
      {
        plannedGarmentQty: batch.plannedGarmentQty,
        skuQtyLines: batch.plannedSkuQtyLines
      }
    ]
  })[0];
  const bag = findTransferBagById(storeRef, created.transferBagId);
  bag.packedBy = input.operatorName;
  bag.createdAt = input.createdAt || bag.createdAt;
  bag.updatedAt = input.createdAt || bag.updatedAt;
  normalizeTransferBagRuntimeFields(bag);
  return clone(bag);
}
function scanFeiTicketIntoTransferBag(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, input.transferBagId);
  const ticket = resolveFeiTicketForSewingDispatch(input.feiTicketNo);
  const batch = findDispatchBatchById(storeRef, bag.dispatchBatchId);
  const order = findDispatchOrderById(storeRef, bag.dispatchOrderId);
  const baseResult = {
    validationId: `CSV-${bag.transferBagId}-${input.feiTicketNo}`,
    dispatchOrderId: bag.dispatchOrderId,
    dispatchBatchId: bag.dispatchBatchId,
    transferBagId: bag.transferBagId,
    productionOrderId: bag.productionOrderId,
    productionOrderNo: bag.productionOrderNo,
    colorName: ticket?.garmentColor || "",
    sizeCode: ticket?.skuSize || "",
    partName: ticket?.partName || "",
    requiredPieceQty: 0,
    scannedPieceQty: 0,
    missingPieceQty: 0,
    overPieceQty: 0,
    specialCraftRequired: false,
    specialCraftStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A",
    blocking: true
  };
  if (!ticket) {
    const result2 = {
      ...baseResult,
      validationType: "\u83F2\u7968\u4E0D\u5C5E\u4E8E\u672C\u751F\u4EA7\u5355",
      validationMessage: "\u672A\u627E\u5230\u83F2\u7968"
    };
    storeRef.validationResults.push(result2);
    return { updatedTransferBag: clone(bag), validationResult: clone(result2) };
  }
  if (ticket.productionOrderId !== bag.productionOrderId) {
    const result2 = {
      ...baseResult,
      validationType: "\u83F2\u7968\u4E0D\u5C5E\u4E8E\u672C\u751F\u4EA7\u5355",
      validationMessage: "\u83F2\u7968\u4E0D\u5C5E\u4E8E\u672C\u751F\u4EA7\u5355"
    };
    storeRef.validationResults.push(result2);
    return { updatedTransferBag: clone(bag), validationResult: clone(result2) };
  }
  if (getOccupiedFeiTicketNos({ excludeBagId: bag.transferBagId }).has(ticket.feiTicketNo)) {
    const result2 = {
      ...baseResult,
      validationType: "\u83F2\u7968\u5DF2\u53D1\u51FA",
      validationMessage: "\u83F2\u7968\u5DF2\u88AB\u5176\u4ED6\u672A\u5173\u95ED\u4E2D\u8F6C\u888B\u5360\u7528\u6216\u5DF2\u53D1\u51FA"
    };
    storeRef.validationResults.push(result2);
    return { updatedTransferBag: clone(bag), validationResult: clone(result2) };
  }
  normalizeTransferBagRuntimeFields(bag);
  let pieceLine = bag.pieceLines.find(
    (line) => line.colorName === ticket.garmentColor && line.sizeCode === ticket.skuSize && line.partName === ticket.partName
  );
  if (!pieceLine) {
    const requiredLine = getRequiredLinesForBag(batch).find(
      (line) => line.colorName === ticket.garmentColor && line.sizeCode === ticket.skuSize && line.partName === ticket.partName
    );
    if (requiredLine) {
      pieceLine = buildPieceLineFromRequiredLine(requiredLine, bag.transferBagId, bag.pieceLines.length);
      bag.pieceLines.push(pieceLine);
      if (!bag.skuQtyLines.some((line) => line.colorName === ticket.garmentColor && line.sizeCode === ticket.skuSize)) {
        const skuLine = batch.plannedSkuQtyLines.find((line) => line.colorName === ticket.garmentColor && line.sizeCode === ticket.skuSize);
        if (skuLine) bag.skuQtyLines.push({ ...skuLine });
      }
    }
  }
  if (!pieceLine) {
    const result2 = {
      ...baseResult,
      validationType: bag.skuQtyLines.some((line) => line.colorName === ticket.garmentColor) ? bag.skuQtyLines.some((line) => line.sizeCode === ticket.skuSize) ? "\u83F2\u7968\u90E8\u4F4D\u4E0D\u5339\u914D" : "\u83F2\u7968\u5C3A\u7801\u4E0D\u5339\u914D" : "\u83F2\u7968\u989C\u8272\u4E0D\u5339\u914D",
      validationMessage: "\u83F2\u7968\u4E0D\u5C5E\u4E8E\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55"
    };
    storeRef.validationResults.push(result2);
    return { updatedTransferBag: clone(bag), validationResult: clone(result2) };
  }
  const specialCraft = mapSpecialCraftReturnStatus(ticket.feiTicketNo);
  if (specialCraft.specialCraftRequired && specialCraft.specialCraftReturnStatus !== "\u5DF2\u56DE\u4ED3") {
    const result2 = {
      ...baseResult,
      requiredPieceQty: pieceLine.requiredPieceQty,
      scannedPieceQty: pieceLine.scannedPieceQty,
      missingPieceQty: pieceLine.missingPieceQty,
      specialCraftRequired: true,
      specialCraftStatus: specialCraft.specialCraftReturnStatus,
      validationType: specialCraft.specialCraftReturnStatus === "\u5DEE\u5F02" ? "\u7279\u6B8A\u5DE5\u827A\u5DEE\u5F02" : specialCraft.specialCraftReturnStatus === "\u5F02\u8BAE\u4E2D" ? "\u7279\u6B8A\u5DE5\u827A\u5F02\u8BAE\u4E2D" : "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3",
      validationMessage: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\uFF0C\u6682\u4E0D\u52A0\u5165\u672C\u6B21\u8F66\u7F1D\u4EA4\u51FA\uFF1B\u4E0D\u5F71\u54CD\u5176\u4ED6\u5DF2\u88C1\u51FA\u90E8\u4F4D\u63D0\u4EA4\u4EA4\u51FA\u8BB0\u5F55",
      blocking: false
    };
    storeRef.validationResults.push(result2);
    return { updatedTransferBag: clone(bag), validationResult: clone(result2) };
  }
  const nextScannedQty = pieceLine.scannedPieceQty + getTicketDispatchQty(ticket);
  if (nextScannedQty > pieceLine.requiredPieceQty) {
    const result2 = {
      ...baseResult,
      requiredPieceQty: pieceLine.requiredPieceQty,
      scannedPieceQty: nextScannedQty,
      overPieceQty: nextScannedQty - pieceLine.requiredPieceQty,
      specialCraftRequired: specialCraft.specialCraftRequired,
      specialCraftStatus: specialCraft.specialCraftReturnStatus,
      validationType: "\u88C1\u7247\u8D85\u51FA",
      validationMessage: "\u626B\u7801\u83F2\u7968\u6570\u91CF\u8D85\u51FA\u672C\u888B\u5E94\u914D\u6570\u91CF"
    };
    storeRef.validationResults.push(result2);
    return { updatedTransferBag: clone(bag), validationResult: clone(result2) };
  }
  pieceLine.scannedPieceQty = nextScannedQty;
  pieceLine.scannedFeiTicketNos = unique([...pieceLine.scannedFeiTicketNos, ticket.feiTicketNo]);
  pieceLine.missingPieceQty = Math.max(pieceLine.requiredPieceQty - pieceLine.scannedPieceQty, 0);
  pieceLine.overPieceQty = Math.max(pieceLine.scannedPieceQty - pieceLine.requiredPieceQty, 0);
  pieceLine.specialCraftRequired = specialCraft.specialCraftRequired;
  pieceLine.specialCraftReturnStatus = specialCraft.specialCraftReturnStatus;
  pieceLine.completeStatus = pieceLine.missingPieceQty === 0 && pieceLine.overPieceQty === 0 ? "\u5DF2\u6838\u5BF9" : "\u6709\u7F3A\u53E3";
  bag.scannedFeiTicketNos = unique([...bag.scannedFeiTicketNos, ticket.feiTicketNo]);
  if (!bag.contentItems.some((item) => item.sourceKind === "FEI_TICKET" && item.feiTicketNo === ticket.feiTicketNo)) {
    bag.contentItems.push(buildContentItemFromFeiTicket(bag, ticket));
  }
  bag.status = bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B";
  bag.packStatus = bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B";
  bag.currentLocation = "\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA";
  bag.editableBeforeHandover = true;
  bag.lastPackedAt = nowText();
  bag.completeStatus = "\u672A\u6821\u9A8C";
  bag.updatedAt = nowText();
  normalizeTransferBagRuntimeFields(bag);
  batch.feiTicketNos = unique([...batch.feiTicketNos, ticket.feiTicketNo]);
  order.feiTicketNos = unique([...order.feiTicketNos, ticket.feiTicketNo]);
  const result = {
    ...baseResult,
    requiredPieceQty: pieceLine.requiredPieceQty,
    scannedPieceQty: pieceLine.scannedPieceQty,
    missingPieceQty: pieceLine.missingPieceQty,
    overPieceQty: pieceLine.overPieceQty,
    specialCraftRequired: specialCraft.specialCraftRequired,
    specialCraftStatus: specialCraft.specialCraftReturnStatus,
    validationType: "\u901A\u8FC7",
    validationMessage: "\u83F2\u7968\u5DF2\u626B\u7801\u88C5\u888B",
    blocking: false
  };
  storeRef.validationResults.push(result);
  validateTransferBagCompleteness(bag.transferBagId);
  updateDispatchOrderFromChildren(order);
  return { updatedTransferBag: clone(bag), validationResult: clone(result) };
}
function scanFeiTicketIntoTransferBagOnMobile(input) {
  const result = scanFeiTicketIntoTransferBag({ transferBagId: input.transferBagId, feiTicketNo: input.feiTicketNo });
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, input.transferBagId);
  bag.packedBy = input.operatorName || bag.packedBy || "\u73B0\u573A\u64CD\u4F5C\u5458";
  bag.packedAt = bag.packedAt || input.operatedAt || nowText();
  bag.lastPackedAt = input.operatedAt || nowText();
  bag.packStatus = bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B";
  normalizeTransferBagRuntimeFields(bag);
  return { updatedTransferBag: clone(bag), validationResult: result.validationResult };
}
function removeFeiTicketFromTransferBag(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, input.transferBagId);
  assertTransferBagEditableBeforeHandover(bag.transferBagId);
  bag.scannedFeiTicketNos = bag.scannedFeiTicketNos.filter((feiTicketNo) => feiTicketNo !== input.feiTicketNo);
  bag.contentItems = (bag.contentItems || []).filter((item) => item.feiTicketNo !== input.feiTicketNo);
  bag.pieceLines.forEach((line) => {
    if (!line.scannedFeiTicketNos.includes(input.feiTicketNo)) return;
    const ticket = resolveFeiTicketForSewingDispatch(input.feiTicketNo);
    line.scannedFeiTicketNos = line.scannedFeiTicketNos.filter((feiTicketNo) => feiTicketNo !== input.feiTicketNo);
    line.scannedPieceQty = Math.max(line.scannedPieceQty - (ticket ? getTicketDispatchQty(ticket) : 0), 0);
    line.missingPieceQty = Math.max(line.requiredPieceQty - line.scannedPieceQty, 0);
    line.overPieceQty = Math.max(line.scannedPieceQty - line.requiredPieceQty, 0);
    line.completeStatus = line.missingPieceQty === 0 && line.overPieceQty === 0 ? "\u5DF2\u6838\u5BF9" : "\u6709\u7F3A\u53E3";
  });
  bag.status = bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B";
  bag.packStatus = bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B";
  bag.completeStatus = "\u672A\u6821\u9A8C";
  bag.updatedAt = nowText();
  normalizeTransferBagRuntimeFields(bag);
  validateTransferBagCompleteness(bag.transferBagId);
  return clone(bag);
}
function assertTransferBagEditableBeforeHandover(transferBagId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, transferBagId);
  normalizeTransferBagRuntimeFields(bag);
  if (!bag.editableBeforeHandover || bag.dispatchStatus !== "\u672A\u4EA4\u51FA" || bag.handoverSubmittedAt || bag.receivedAt) {
    throw new Error("\u5DF2\u4EA4\u51FA\u6216\u5DF2\u56DE\u5199\u7684\u4E2D\u8F6C\u888B\u4E0D\u53EF\u8C03\u6574");
  }
}
function removeTransferBagContentItemBeforeHandover(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, input.transferBagId);
  const item = (bag.contentItems || []).find(
    (contentItem) => input.contentItemId ? contentItem.contentItemId === input.contentItemId : Boolean(input.feiTicketNo && contentItem.feiTicketNo === input.feiTicketNo)
  );
  if (!item?.feiTicketNo) {
    assertTransferBagEditableBeforeHandover(input.transferBagId);
    bag.contentItems = (bag.contentItems || []).filter((contentItem) => contentItem.contentItemId !== input.contentItemId);
    normalizeTransferBagRuntimeFields(bag);
    return clone(bag);
  }
  return removeFeiTicketFromTransferBag({ transferBagId: input.transferBagId, feiTicketNo: item.feiTicketNo });
}
function recalcTransferBagContentSummary(transferBagId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, transferBagId);
  normalizeTransferBagRuntimeFields(bag);
  bag.updatedAt = nowText();
  return clone(bag);
}
function validateTransferBagCompleteness(transferBagId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, transferBagId);
  normalizeTransferBagRuntimeFields(bag);
  const results = [];
  bag.pieceLines.forEach((line, index) => {
    const validationBase = {
      validationId: `CSV-${bag.transferBagId}-${String(index + 1).padStart(3, "0")}`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: line.colorName,
      sizeCode: line.sizeCode,
      partName: line.partName,
      requiredPieceQty: line.requiredPieceQty,
      scannedPieceQty: line.scannedPieceQty,
      missingPieceQty: line.missingPieceQty,
      overPieceQty: line.overPieceQty,
      specialCraftRequired: line.specialCraftRequired,
      specialCraftStatus: line.specialCraftReturnStatus,
      blocking: true
    };
    if (line.specialCraftRequired && line.specialCraftReturnStatus !== "\u5DF2\u56DE\u4ED3") {
      results.push({
        ...validationBase,
        validationType: line.specialCraftReturnStatus === "\u5DEE\u5F02" ? "\u7279\u6B8A\u5DE5\u827A\u5DEE\u5F02" : line.specialCraftReturnStatus === "\u5F02\u8BAE\u4E2D" ? "\u7279\u6B8A\u5DE5\u827A\u5F02\u8BAE\u4E2D" : "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3",
        validationMessage: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\uFF0C\u4EA4\u51FA\u540E\u5C06\u5F62\u6210\u7F3A\u53E3",
        blocking: false
      });
    } else if (line.missingPieceQty > 0) {
      results.push({ ...validationBase, validationType: "\u7F3A\u5C11\u88C1\u7247", validationMessage: "\u7F3A\u5C11\u88C1\u7247\uFF0C\u4EA4\u51FA\u540E\u5C06\u5F62\u6210\u7F3A\u53E3", blocking: false });
    } else if (line.overPieceQty > 0) {
      results.push({ ...validationBase, validationType: "\u88C1\u7247\u8D85\u51FA", validationMessage: "\u88C1\u7247\u8D85\u51FA\uFF0C\u6309\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u8FFD\u8E2A", blocking: false });
    } else {
      results.push({ ...validationBase, validationType: "\u901A\u8FC7", validationMessage: "\u7F3A\u53E3\u6838\u5BF9\u901A\u8FC7", blocking: false });
    }
  });
  const hasGap = results.some(isHandoverGapResult);
  bag.completeStatus = hasGap ? "\u6709\u7F3A\u53E3" : "\u5DF2\u6838\u5BF9";
  bag.status = bag.scannedFeiTicketNos.length ? "\u5DF2\u6838\u5BF9" : "\u5F85\u88C5\u888B";
  bag.packStatus = bag.scannedFeiTicketNos.length ? "\u5DF2\u88C5\u888B" : "\u5F85\u88C5\u888B";
  bag.editableBeforeHandover = bag.dispatchStatus === "\u672A\u4EA4\u51FA" && !bag.handoverSubmittedAt && !bag.receivedAt;
  bag.updatedAt = nowText();
  normalizeTransferBagRuntimeFields(bag);
  storeRef.validationResults = [
    ...storeRef.validationResults.filter((item) => item.transferBagId !== bag.transferBagId || item.validationType === "\u901A\u8FC7"),
    ...results
  ];
  return { updatedTransferBag: clone(bag), validationResults: clone(results) };
}
function validateTransferBagForMixedPacking(transferBagId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, transferBagId);
  const batch = findDispatchBatchById(storeRef, bag.dispatchBatchId);
  normalizeTransferBagRuntimeFields(bag);
  const duplicateTickets = bag.scannedFeiTicketNos.filter((feiTicketNo, index, list) => list.indexOf(feiTicketNo) !== index);
  const results = [];
  duplicateTickets.forEach((feiTicketNo) => {
    const ticket = resolveFeiTicketForSewingDispatch(feiTicketNo);
    results.push({
      validationId: `CSV-${bag.transferBagId}-${feiTicketNo}-DUP`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: ticket?.garmentColor || "",
      sizeCode: ticket?.skuSize || "",
      partName: ticket?.partName || "",
      requiredPieceQty: 0,
      scannedPieceQty: 0,
      missingPieceQty: 0,
      overPieceQty: 0,
      specialCraftRequired: false,
      specialCraftStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A",
      validationType: "\u83F2\u7968\u91CD\u590D",
      validationMessage: "\u83F2\u7968\u91CD\u590D\u88C5\u888B",
      blocking: true
    });
  });
  bag.contentItems.forEach((item, index) => {
    if (item.sourceKind !== "FEI_TICKET") return;
    const ticket = item.feiTicketNo ? resolveFeiTicketForSewingDispatch(item.feiTicketNo) : void 0;
    const belongsToBatch = ticket && ticket.productionOrderId === batch.productionOrderId;
    if (belongsToBatch) return;
    results.push({
      validationId: `CSV-${bag.transferBagId}-CONTENT-${String(index + 1).padStart(3, "0")}`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: item.colorName || "",
      sizeCode: item.sizeCode || "",
      partName: item.partName || "",
      requiredPieceQty: 0,
      scannedPieceQty: item.currentQty,
      missingPieceQty: 0,
      overPieceQty: 0,
      specialCraftRequired: false,
      specialCraftStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A",
      validationType: "\u83F2\u7968\u4E0D\u5C5E\u4E8E\u672C\u751F\u4EA7\u5355",
      validationMessage: "\u888B\u5185\u83F2\u7968\u4E0D\u5C5E\u4E8E\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55",
      blocking: true
    });
  });
  if (!results.length) {
    results.push({
      validationId: `CSV-${bag.transferBagId}-MIXED-OK`,
      dispatchOrderId: bag.dispatchOrderId,
      dispatchBatchId: bag.dispatchBatchId,
      transferBagId: bag.transferBagId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      colorName: "\u6DF7\u88C5",
      sizeCode: "\u6DF7\u88C5",
      partName: "\u888B\u5185\u660E\u7EC6",
      requiredPieceQty: bag.contentFeiTicketCount,
      scannedPieceQty: bag.contentFeiTicketCount,
      missingPieceQty: 0,
      overPieceQty: 0,
      specialCraftRequired: false,
      specialCraftStatus: "\u4E0D\u9700\u8981\u7279\u6B8A\u5DE5\u827A",
      validationType: "\u901A\u8FC7",
      validationMessage: "\u6DF7\u88C5\u888B\u5185\u660E\u7EC6\u5408\u6CD5",
      blocking: false
    });
  }
  return { updatedTransferBag: clone(bag), validationResults: clone(results) };
}
function validateDispatchBatchCompleteness(dispatchBatchId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = findDispatchBatchById(storeRef, dispatchBatchId);
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId);
  const bagLegalityResults = batch.transferBagIds.flatMap((transferBagId) => validateTransferBagForMixedPacking(transferBagId).validationResults);
  const scannedByKey = /* @__PURE__ */ new Map();
  batch.transferBagIds.forEach((transferBagId) => {
    const bag = findTransferBagById(storeRef, transferBagId);
    normalizeTransferBagRuntimeFields(bag);
    bag.pieceLines.forEach((line) => {
      const key = `${line.colorName}|${line.sizeCode}|${line.partName}`;
      const current = scannedByKey.get(key) || { qty: 0, ticketNos: [] };
      current.qty += line.scannedPieceQty;
      current.ticketNos.push(...line.scannedFeiTicketNos);
      scannedByKey.set(key, current);
    });
  });
  const batchResults = getRequiredLinesForBag(batch).map((line, index) => {
    const key = `${line.colorName}|${line.sizeCode}|${line.partName}`;
    const scanned = scannedByKey.get(key)?.qty || 0;
    const missingPieceQty = Math.max(line.requiredPieceQty - scanned, 0);
    const overPieceQty = Math.max(scanned - line.requiredPieceQty, 0);
    const validationBase = {
      validationId: `CSV-${batch.dispatchBatchId}-BATCH-${String(index + 1).padStart(3, "0")}`,
      dispatchOrderId: batch.dispatchOrderId,
      dispatchBatchId: batch.dispatchBatchId,
      transferBagId: batch.transferBagIds[0] || "",
      productionOrderId: batch.productionOrderId,
      productionOrderNo: batch.productionOrderNo,
      colorName: line.colorName,
      sizeCode: line.sizeCode,
      partName: line.partName,
      requiredPieceQty: line.requiredPieceQty,
      scannedPieceQty: scanned,
      missingPieceQty,
      overPieceQty,
      specialCraftRequired: line.specialCraftRequired,
      specialCraftStatus: line.specialCraftReturnStatus,
      blocking: true
    };
    if (line.specialCraftRequired && line.specialCraftReturnStatus !== "\u5DF2\u56DE\u4ED3") {
      return {
        ...validationBase,
        validationType: line.specialCraftReturnStatus === "\u5DEE\u5F02" ? "\u7279\u6B8A\u5DE5\u827A\u5DEE\u5F02" : line.specialCraftReturnStatus === "\u5F02\u8BAE\u4E2D" ? "\u7279\u6B8A\u5DE5\u827A\u5F02\u8BAE\u4E2D" : "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3",
        validationMessage: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\uFF0C\u4EA4\u51FA\u540E\u5C06\u5F62\u6210\u7F3A\u53E3",
        blocking: false
      };
    }
    if (missingPieceQty > 0) {
      return { ...validationBase, validationType: "\u7F3A\u5C11\u88C1\u7247", validationMessage: "\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u7F3A\u5C11\u88C1\u7247\uFF0C\u4EA4\u51FA\u540E\u5C55\u793A\u7F3A\u53E3", blocking: false };
    }
    if (overPieceQty > 0) {
      return { ...validationBase, validationType: "\u88C1\u7247\u8D85\u51FA", validationMessage: "\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u88C1\u7247\u8D85\u51FA\uFF0C\u6309\u5DEE\u5F02\u8FFD\u8E2A", blocking: false };
    }
    return {
      ...validationBase,
      validationType: "\u901A\u8FC7",
      validationMessage: "\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u7F3A\u53E3\u6838\u5BF9\u901A\u8FC7",
      blocking: false
    };
  });
  const results = [...bagLegalityResults, ...batchResults];
  const blocking = results.some((result) => result.blocking);
  const hasGap = results.some(isHandoverGapResult);
  batch.completeStatus = blocking || hasGap ? "\u6709\u7F3A\u53E3" : "\u5DF2\u6838\u5BF9";
  batch.status = blocking ? "\u88C5\u888B\u4E2D" : "\u5DF2\u6838\u5BF9";
  batch.updatedAt = nowText();
  batch.transferBagIds.forEach((transferBagId) => {
    const bag = findTransferBagById(storeRef, transferBagId);
    normalizeTransferBagRuntimeFields(bag);
    if (!blocking) {
      const hasBagGap = results.some((result) => result.transferBagId === transferBagId && isHandoverGapResult(result));
      bag.completeStatus = hasBagGap ? "\u6709\u7F3A\u53E3" : "\u5DF2\u6838\u5BF9";
      bag.status = "\u5DF2\u6838\u5BF9";
      bag.packStatus = bag.scannedFeiTicketNos.length ? "\u5DF2\u88C5\u888B" : bag.packStatus;
      bag.updatedAt = batch.updatedAt;
    }
  });
  order.status = blocking ? "\u5F85\u6838\u5BF9" : "\u53EF\u4EA4\u51FA";
  order.validationStatus = blocking ? "\u6821\u9A8C\u672A\u901A\u8FC7" : "\u6821\u9A8C\u901A\u8FC7";
  order.validationMessages = unique(results.filter((item) => item.blocking).map((item) => item.validationMessage));
  storeRef.validationResults = [
    ...storeRef.validationResults.filter((item) => item.dispatchBatchId !== batch.dispatchBatchId),
    ...results
  ];
  updateDispatchOrderFromChildren(order);
  return { updatedDispatchBatch: clone(batch), validationResults: clone(results) };
}
function assertSewingDispatchAllowed(dispatchBatchId) {
  const validation = validateDispatchBatchCompleteness(dispatchBatchId);
  const blocking = validation.validationResults.find((item) => item.blocking);
  if (blocking) throw new Error(blocking.validationMessage);
}
function submitCuttingSewingDispatchBatch(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const validation = validateDispatchBatchCompleteness(input.dispatchBatchId);
  const blocking = validation.validationResults.find((item) => item.blocking);
  if (blocking) throw new Error(blocking.validationMessage);
  const batch = findDispatchBatchById(storeRef, input.dispatchBatchId);
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId);
  const submittedPieceQty = getDispatchBatchPieceQty(storeRef, batch);
  if (submittedPieceQty <= 0) throw new Error("\u5F53\u524D\u6CA1\u6709\u53EF\u4EA4\u51FA\u88C1\u7247\uFF0C\u4E0D\u80FD\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55");
  const gapSummary = buildDispatchGapSummary(validation.validationResults);
  const cuttingHandoverSummary = buildCuttingHandoverRecordSummary(storeRef, order, batch, submittedPieceQty);
  if (batch.handoverRecordId) {
    const record2 = findPdaHandoverRecord(batch.handoverRecordId);
    if (record2) {
      return {
        handoverOrder: upsertPdaHandoverHeadMock(buildHandoverHead(order)),
        handoverRecord: record2,
        outboundRecords: [],
        updatedWaitHandoverStockItems: [],
        updatedDispatchBatch: clone(batch),
        updatedTransferBags: clone(storeRef.transferBags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId)))
      };
    }
  }
  const handoverOrder = upsertPdaHandoverHeadMock(buildHandoverHead(order));
  const record = createFactoryHandoverRecord({
    handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
    submittedQty: submittedPieceQty,
    qtyUnit: "\u7247",
    factorySubmittedAt: input.submittedAt,
    factorySubmittedBy: input.operatorName,
    factoryRemark: [
      `\u4E2D\u8F6C\u5355\uFF1A${batch.transferOrderNo}`,
      `\u4E2D\u8F6C\u888B\uFF1A${batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId).transferBagNo).join("\u3001")}`,
      gapSummary
    ].filter(Boolean).join("\uFF1B"),
    objectType: "CUT_PIECE",
    handoutObjectType: "CUT_PIECE",
    handoutItemLabel: `\u4EA4\u51FA\u5355 ${batch.transferOrderNo}`,
    garmentEquivalentQty: getDispatchBatchSubmittedGarmentQty(storeRef, batch),
    skuColor: batch.plannedSkuQtyLines.map((line) => line.colorName).join("\u3001"),
    skuSize: batch.plannedSkuQtyLines.map((line) => line.sizeCode).join("\u3001"),
    pieceName: unique(batch.transferBagIds.flatMap((bagId) => findTransferBagById(storeRef, bagId).pieceLines.map((line) => line.partName))).join("\u3001"),
    cutPieceLines: buildHandoverCutPieceLines(storeRef, batch)
  });
  const expectedTransferBagCount = batch.transferBagIds.length;
  const expectedFeiTicketCount = batch.transferBagIds.reduce((total, bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    normalizeTransferBagRuntimeFields(bag);
    return total + bag.contentFeiTicketCount;
  }, 0);
  const recordWithTransferBagFields = upsertPdaHandoutRecordMock({
    ...record,
    cuttingHandoverSummary,
    expectedTransferBagCount,
    receivedTransferBagCount: 0,
    expectedFeiTicketCount,
    receivedFeiTicketCount: 0,
    writebackMode: "\u6309\u888B + \u83F2\u7968",
    combinedWritebackStatus: "\u5F85\u56DE\u5199",
    transferBagWritebackLines: batch.transferBagIds.map((bagId) => {
      const bag = findTransferBagById(storeRef, bagId);
      normalizeTransferBagRuntimeFields(bag);
      const expectedQty = bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0);
      return {
        lineId: `TBWL-${record.recordId}-${bag.transferBagId}`,
        handoverRecordId: record.handoverRecordId || record.recordId,
        transferBagId: bag.transferBagId,
        transferBagNo: bag.transferBagNo,
        expectedFeiTicketCount: bag.contentFeiTicketCount,
        receivedFeiTicketCount: 0,
        expectedQty,
        actualQty: 0,
        differenceQty: -expectedQty,
        status: "\u5F85\u56DE\u5199"
      };
    }),
    feiTicketWritebackLines: []
  });
  const linkage = linkHandoverRecordToOutboundRecord({
    handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
    handoverOrderNo: handoverOrder.handoverOrderNo || handoverOrder.handoverId,
    handoverRecordId: recordWithTransferBagFields.handoverRecordId || recordWithTransferBagFields.recordId,
    handoverRecordNo: recordWithTransferBagFields.handoverRecordNo || recordWithTransferBagFields.recordId,
    handoverRecordQrValue: recordWithTransferBagFields.handoverRecordQrValue,
    taskId: batch.dispatchBatchId,
    taskNo: batch.dispatchBatchNo,
    factoryId: order.cuttingFactoryId,
    factoryName: order.cuttingFactoryName,
    receiverKind: "\u540E\u9053\u5DE5\u5382",
    receiverName: order.sewingFactoryName,
    itemKind: "\u88C1\u7247",
    itemName: `\u4EA4\u51FA\u5355 ${batch.transferOrderNo}`,
    transferBagNo: batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId).transferBagNo).join("\u3001"),
    submittedQty: recordWithTransferBagFields.submittedQty,
    unit: recordWithTransferBagFields.qtyUnit,
    operatorName: input.operatorName,
    submittedAt: input.submittedAt
  });
  batch.handoverRecordId = recordWithTransferBagFields.handoverRecordId || recordWithTransferBagFields.recordId;
  batch.handoverRecordNo = recordWithTransferBagFields.handoverRecordNo || recordWithTransferBagFields.recordId;
  batch.status = "\u5DF2\u4EA4\u51FA";
  batch.updatedAt = input.submittedAt;
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    bag.status = "\u5DF2\u4EA4\u51FA";
    bag.dispatchStatus = "\u5DF2\u4EA4\u51FA";
    bag.packStatus = "\u5DF2\u4EA4\u51FA";
    bag.currentLocation = "\u4E0B\u6E38\u5DE5\u5382\u5F85\u63A5\u6536";
    bag.editableBeforeHandover = false;
    bag.handoverSubmittedAt = input.submittedAt;
    bag.updatedAt = input.submittedAt;
  });
  order.handoverOrderId = handoverOrder.handoverOrderId || handoverOrder.handoverId;
  order.handoverOrderNo = handoverOrder.handoverOrderNo || handoverOrder.handoverId;
  order.handoverRecordIds = unique([...order.handoverRecordIds, recordWithTransferBagFields.handoverRecordId || recordWithTransferBagFields.recordId]);
  order.status = "\u5DF2\u4EA4\u51FA";
  order.updatedAt = input.submittedAt;
  updateDispatchOrderFromChildren(order);
  return {
    handoverOrder,
    handoverRecord: recordWithTransferBagFields,
    outboundRecords: [linkage.outboundRecord],
    updatedWaitHandoverStockItems: [linkage.updatedWaitHandoverStockItem],
    updatedDispatchBatch: clone(batch),
    updatedTransferBags: clone(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId)))
  };
}
function getDispatchBatchPieceQty(storeRef, batch) {
  return sum(
    batch.transferBagIds.map(
      (bagId) => findTransferBagById(storeRef, bagId).pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)
    )
  );
}
function getDispatchBatchSubmittedGarmentQty(storeRef, batch) {
  const garmentQtyBySku = /* @__PURE__ */ new Map();
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    bag.pieceLines.forEach((line) => {
      const pieceCountPerGarment = Math.max(line.pieceCountPerGarment || 1, 1);
      const garmentQty = Math.floor(Math.max(line.scannedPieceQty || 0, 0) / pieceCountPerGarment);
      if (garmentQty <= 0) return;
      const skuKey = `${line.colorName}|${line.sizeCode}`;
      garmentQtyBySku.set(skuKey, Math.max(garmentQtyBySku.get(skuKey) || 0, garmentQty));
    });
  });
  return sum([...garmentQtyBySku.values()]);
}
function getDispatchBatchRequiredPieceQty(storeRef, batch) {
  return sum(
    batch.transferBagIds.map(
      (bagId) => findTransferBagById(storeRef, bagId).pieceLines.reduce((total, line) => total + line.requiredPieceQty, 0)
    )
  );
}
function buildHandoverHead(order) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batches = storeRef.dispatchBatches.filter((batch) => batch.dispatchOrderId === order.dispatchOrderId);
  const submittedBatches = batches.filter((batch) => Boolean(batch.handoverRecordId));
  const hasObjection = submittedBatches.some((batch) => batch.status === "\u5F02\u8BAE\u4E2D");
  const hasDifference = submittedBatches.some((batch) => batch.status === "\u5DEE\u5F02");
  const pendingWritebackCount = submittedBatches.filter((batch) => batch.status === "\u5DF2\u4EA4\u51FA").length;
  const allWrittenBack = submittedBatches.length > 0 && submittedBatches.every((batch) => batch.status === "\u5DF2\u56DE\u5199");
  const handoverId = order.handoverOrderId || `HO-CSD-${order.dispatchOrderId}`;
  const submittedQtyTotal = sum(submittedBatches.map((batch) => getDispatchBatchPieceQty(storeRef, batch)));
  const expectedQtyTotal = sum(batches.map((batch) => getDispatchBatchRequiredPieceQty(storeRef, batch)));
  const writtenBackQtyTotal = sum(submittedBatches.map((batch) => batch.receiverWrittenQty || 0));
  const diffQtyTotal = sum(submittedBatches.map((batch) => batch.differenceQty || 0));
  return {
    handoverId,
    handoverOrderId: handoverId,
    handoverOrderNo: order.handoverOrderNo || `JCD-${order.productionOrderNo}-${order.dispatchOrderId.replace(/[^0-9A-Za-z]/g, "").slice(-4)}`,
    headType: "HANDOUT",
    qrCodeValue: buildHandoverOrderQrValue(handoverId),
    handoverOrderQrValue: buildHandoverOrderQrValue(handoverId),
    taskId: order.dispatchOrderId,
    sourceTaskId: order.dispatchOrderId,
    taskNo: order.dispatchOrderNo,
    sourceTaskNo: order.dispatchOrderNo,
    productionOrderNo: order.productionOrderNo,
    processName: "\u4EA4\u51FA\u5355",
    sourceFactoryName: order.cuttingFactoryName,
    sourceFactoryId: order.cuttingFactoryId,
    targetName: order.sewingFactoryName,
    targetKind: "FACTORY",
    receiverKind: "MANAGED_POST_FACTORY",
    receiverId: order.sewingFactoryId,
    receiverName: order.sewingFactoryName,
    qtyUnit: "\u7247",
    factoryId: order.cuttingFactoryId,
    taskStatus: "DONE",
    summaryStatus: hasObjection ? "HAS_OBJECTION" : allWrittenBack ? "WRITTEN_BACK" : hasDifference || writtenBackQtyTotal > 0 ? "PARTIAL_WRITTEN_BACK" : submittedBatches.length ? "SUBMITTED" : "NONE",
    recordCount: submittedBatches.length,
    pendingWritebackCount,
    submittedQtyTotal,
    writtenBackQtyTotal,
    diffQtyTotal,
    objectionCount: submittedBatches.filter((batch) => batch.status === "\u5F02\u8BAE\u4E2D").length,
    lastRecordAt: submittedBatches.map((batch) => batch.updatedAt).sort((a, b) => b.localeCompare(a))[0] || order.updatedAt,
    plannedQty: order.plannedDispatchGarmentQty,
    completionStatus: order.status === "\u5DF2\u56DE\u5199" || allWrittenBack ? "COMPLETED" : "OPEN",
    qtyExpectedTotal: expectedQtyTotal || submittedQtyTotal || order.plannedDispatchGarmentQty,
    qtyActualTotal: writtenBackQtyTotal,
    qtyDiffTotal: (expectedQtyTotal || submittedQtyTotal || order.plannedDispatchGarmentQty) - writtenBackQtyTotal,
    transitionFromPrev: "NOT_APPLICABLE",
    transitionToNext: "NOT_APPLICABLE",
    stageCode: "POST",
    stageName: "\u4EA4\u51FA\u5355",
    processBusinessCode: "CUT_PANEL",
    processBusinessName: "\u88C1\u7247",
    taskTypeCode: "CUT_PIECE_SEWING_DISPATCH",
    taskTypeLabel: "\u4EA4\u51FA\u5355",
    assignmentGranularity: "SKU",
    assignmentGranularityLabel: "\u989C\u8272\u5C3A\u7801",
    isSpecialCraft: false
  };
}
function buildHandoverCutPieceLines(storeRef, batch) {
  return batch.transferBagIds.flatMap((bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    return bag.pieceLines.map((line) => ({
      lineId: `${bag.transferBagId}-${line.pieceLineId}`,
      piecePartLabel: line.partName,
      garmentSkuCode: `${line.colorName}-${line.sizeCode}`,
      garmentSkuLabel: `${line.colorName} / ${line.sizeCode}`,
      colorLabel: line.colorName,
      sizeLabel: line.sizeCode,
      pieceQty: line.scannedPieceQty,
      garmentEquivalentQty: Math.floor(Math.max(line.scannedPieceQty || 0, 0) / Math.max(line.pieceCountPerGarment || 1, 1))
    }));
  });
}
function getTransferBagContentDisplayItems(transferBagId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = findTransferBagById(storeRef, transferBagId);
  normalizeTransferBagRuntimeFields(bag);
  return clone(
    [...bag.contentItems].sort(
      (left, right) => `${left.colorName || ""}-${left.sizeCode || ""}-${left.partName || ""}-${left.sourceNo || ""}`.localeCompare(
        `${right.colorName || ""}-${right.sizeCode || ""}-${right.partName || ""}-${right.sourceNo || ""}`,
        "zh-CN"
      )
    )
  );
}
function getTransferBagScanSummaryByQr(qrValue) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = storeRef.transferBags.find((item) => item.transferBagQrValue === qrValue || item.transferBagNo === qrValue);
  if (!bag) return null;
  const order = findDispatchOrderById(storeRef, bag.dispatchOrderId);
  const batch = findDispatchBatchById(storeRef, bag.dispatchBatchId);
  normalizeTransferBagRuntimeFields(bag);
  const contentItems = getTransferBagContentDisplayItems(bag.transferBagId);
  return {
    transferBagNo: bag.transferBagNo,
    sourceFactoryName: order.cuttingFactoryName,
    receiverFactoryName: order.sewingFactoryName,
    productionOrderNo: bag.productionOrderNo,
    dispatchBatchNo: batch.dispatchBatchNo,
    transferOrderNo: batch.transferOrderNo,
    handoverRecordNo: batch.handoverRecordNo || "\u5F85\u63D0\u4EA4",
    bagStatus: bag.packStatus,
    contentItems,
    contentSummary: {
      contentItemCount: bag.contentItemCount,
      feiTicketCount: bag.contentFeiTicketCount,
      materialLineCount: bag.contentMaterialLineCount,
      totalQty: contentItems.reduce((total, item) => total + item.currentQty, 0),
      mixedLabel: "\u5141\u8BB8\u6DF7\u88C5"
    }
  };
}
function findBatchByHandoverRecordId(storeRef, handoverRecordId) {
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === handoverRecordId);
  if (!batch) throw new Error(`\u672A\u627E\u5230\u4E2D\u8F6C\u5355\u5BF9\u5E94\u4EA4\u51FA\u8BB0\u5F55\uFF1A${handoverRecordId}`);
  return batch;
}
function writebackSewingReceiveByTransferBag(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = findBatchByHandoverRecordId(storeRef, input.handoverRecordId);
  const record = findPdaHandoverRecord(input.handoverRecordId);
  if (!record) throw new Error(`\u672A\u627E\u5230\u4EA4\u51FA\u8BB0\u5F55\uFF1A${input.handoverRecordId}`);
  const receivedNos = new Set(input.receivedTransferBagNos);
  const lines = batch.transferBagIds.map((bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    normalizeTransferBagRuntimeFields(bag);
    const expectedQty = bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0);
    const received = receivedNos.has(bag.transferBagNo);
    bag.receivedAt = received ? input.receivedAt : bag.receivedAt;
    bag.receivedBy = received ? input.receiverName : bag.receivedBy;
    bag.receivedFeiTicketCount = received ? bag.contentFeiTicketCount : 0;
    bag.packStatus = received ? "\u5DF2\u626B\u7801\u63A5\u6536" : "\u5DEE\u5F02";
    bag.currentLocation = received ? "\u4E0B\u6E38\u5DE5\u5382\u5DF2\u63A5\u6536" : "\u5DEE\u5F02\u5F85\u5904\u7406";
    return {
      lineId: `TBWL-${record.recordId}-${bag.transferBagId}`,
      handoverRecordId: record.handoverRecordId || record.recordId,
      transferBagId: bag.transferBagId,
      transferBagNo: bag.transferBagNo,
      expectedFeiTicketCount: bag.contentFeiTicketCount,
      receivedFeiTicketCount: received ? bag.contentFeiTicketCount : 0,
      expectedQty,
      actualQty: received ? expectedQty : 0,
      differenceQty: received ? 0 : -expectedQty,
      status: received ? "\u5DF2\u56DE\u5199" : "\u5DEE\u5F02",
      remark: received ? input.remark : "\u6574\u888B\u672A\u6536\u5230"
    };
  });
  return upsertPdaHandoutRecordMock({
    ...record,
    expectedTransferBagCount: batch.transferBagIds.length,
    receivedTransferBagCount: lines.filter((line) => line.status === "\u5DF2\u56DE\u5199").length,
    expectedFeiTicketCount: lines.reduce((total, line) => total + line.expectedFeiTicketCount, 0),
    receivedFeiTicketCount: lines.reduce((total, line) => total + line.receivedFeiTicketCount, 0),
    transferBagWritebackLines: lines,
    writebackMode: "\u6309\u888B",
    combinedWritebackStatus: lines.some((line) => line.status === "\u5DEE\u5F02") ? "\u5DEE\u5F02" : "\u90E8\u5206\u56DE\u5199"
  });
}
function writebackSewingReceiveByFeiTicket(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = findBatchByHandoverRecordId(storeRef, input.handoverRecordId);
  const record = findPdaHandoverRecord(input.handoverRecordId);
  if (!record) throw new Error(`\u672A\u627E\u5230\u4EA4\u51FA\u8BB0\u5F55\uFF1A${input.handoverRecordId}`);
  const bag = storeRef.transferBags.find((item) => item.transferBagNo === input.transferBagNo && item.dispatchBatchId === batch.dispatchBatchId);
  if (!bag) throw new Error(`\u672A\u627E\u5230\u4E2D\u8F6C\u888B\uFF1A${input.transferBagNo}`);
  normalizeTransferBagRuntimeFields(bag);
  const actualByTicket = new Map(input.receivedFeiTickets.map((item) => [item.feiTicketNo, item]));
  const nextLines = [
    ...(record.feiTicketWritebackLines || []).filter((line) => line.transferBagNo !== bag.transferBagNo),
    ...bag.contentItems.filter((item) => item.sourceKind === "FEI_TICKET" && item.feiTicketNo).map((item) => {
      const actual = actualByTicket.get(item.feiTicketNo || "");
      const actualQty = actual ? Math.max(actual.actualQty, 0) : 0;
      const differenceQty = actualQty - item.currentQty;
      return {
        lineId: `TBFTWL-${record.recordId}-${bag.transferBagId}-${item.feiTicketNo}`,
        handoverRecordId: record.handoverRecordId || record.recordId,
        transferBagId: bag.transferBagId,
        transferBagNo: bag.transferBagNo,
        feiTicketNo: item.feiTicketNo || "",
        partName: item.partName || "",
        colorName: item.colorName || "",
        sizeCode: item.sizeCode || "",
        expectedQty: item.currentQty,
        actualQty,
        differenceQty,
        status: differenceQty === 0 ? "\u5DF2\u56DE\u5199" : "\u5DEE\u5F02",
        remark: actual?.remark
      };
    })
  ];
  bag.receivedFeiTicketCount = nextLines.filter((line) => line.transferBagId === bag.transferBagId && line.actualQty > 0).length;
  bag.packStatus = nextLines.some((line) => line.transferBagId === bag.transferBagId && line.status === "\u5DEE\u5F02") ? "\u5DEE\u5F02" : "\u90E8\u5206\u56DE\u5199";
  bag.itemDifferenceReason = nextLines.some((line) => line.transferBagId === bag.transferBagId && line.status === "\u5DEE\u5F02") ? "\u888B\u5185\u83F2\u7968\u6570\u91CF\u4E0D\u7B26" : void 0;
  return upsertPdaHandoutRecordMock({
    ...record,
    expectedFeiTicketCount: batch.transferBagIds.reduce((total, bagId) => total + findTransferBagById(storeRef, bagId).contentFeiTicketCount, 0),
    receivedFeiTicketCount: nextLines.filter((line) => line.actualQty > 0).length,
    feiTicketWritebackLines: nextLines,
    writebackMode: "\u6309\u888B + \u83F2\u7968",
    combinedWritebackStatus: nextLines.some((line) => line.status === "\u5DEE\u5F02") ? "\u5DEE\u5F02" : "\u90E8\u5206\u56DE\u5199"
  });
}
function finalizeCombinedSewingWriteback(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = findBatchByHandoverRecordId(storeRef, input.handoverRecordId);
  const record = findPdaHandoverRecord(input.handoverRecordId);
  if (!record) throw new Error(`\u672A\u627E\u5230\u4EA4\u51FA\u8BB0\u5F55\uFF1A${input.handoverRecordId}`);
  const expectedQty = batch.transferBagIds.reduce((total, bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    return total + bag.pieceLines.reduce((sum2, line) => sum2 + line.scannedPieceQty, 0);
  }, 0);
  const actualQty = record.feiTicketWritebackLines?.length ? record.feiTicketWritebackLines.reduce((total, line) => total + line.actualQty, 0) : record.transferBagWritebackLines?.reduce((total, line) => total + line.actualQty, 0) || 0;
  const differenceQty = actualQty - expectedQty;
  const written = writeBackHandoverRecord({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: actualQty,
    receiverWrittenAt: input.receiverWrittenAt,
    receiverWrittenBy: input.receiverName,
    receiverRemark: differenceQty === 0 ? "\u8F66\u7F1D\u5382\u6309\u4E2D\u8F6C\u888B\u548C\u83F2\u7968\u56DE\u5199\u65E0\u5DEE\u5F02" : input.differenceReason || "\u8F66\u7F1D\u5382\u56DE\u5199\u5B58\u5728\u5DEE\u5F02",
    diffReason: input.differenceReason
  });
  syncSewingReceiveWritebackToDispatch({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: actualQty,
    receivedTransferBagNos: record.transferBagWritebackLines?.filter((line) => line.actualQty > 0).map((line) => line.transferBagNo) || [],
    receivedFeiTicketNos: record.feiTicketWritebackLines?.filter((line) => line.actualQty > 0).map((line) => line.feiTicketNo) || [],
    receiverName: input.receiverName,
    receiverWrittenAt: input.receiverWrittenAt,
    differenceReason: input.differenceReason
  });
  return upsertPdaHandoutRecordMock({
    ...written,
    transferBagWritebackLines: record.transferBagWritebackLines,
    feiTicketWritebackLines: record.feiTicketWritebackLines,
    expectedTransferBagCount: record.expectedTransferBagCount,
    receivedTransferBagCount: record.receivedTransferBagCount,
    expectedFeiTicketCount: record.expectedFeiTicketCount,
    receivedFeiTicketCount: record.receivedFeiTicketCount,
    writebackMode: "\u6309\u888B + \u83F2\u7968",
    combinedWritebackStatus: differenceQty === 0 ? "\u5DF2\u56DE\u5199" : "\u5DEE\u5F02"
  });
}
function syncSewingReceiveWritebackToDispatch(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === input.handoverRecordId);
  if (!batch) throw new Error(`\u672A\u627E\u5230\u4E2D\u8F6C\u5355\u5BF9\u5E94\u4EA4\u51FA\u8BB0\u5F55\uFF1A${input.handoverRecordId}`);
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId);
  const submittedQty = sum(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId).pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)));
  const differenceQty = input.receiverWrittenQty - submittedQty;
  writeBackHandoverRecord({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: input.receiverWrittenQty,
    receiverWrittenAt: input.receiverWrittenAt,
    receiverWrittenBy: input.receiverName,
    receiverRemark: differenceQty === 0 ? "\u8F66\u7F1D\u5382\u63A5\u6536\u65E0\u5DEE\u5F02" : input.differenceReason,
    diffReason: input.differenceReason
  });
  syncReceiverWritebackToOutboundRecord({
    handoverRecordId: input.handoverRecordId,
    receiverWrittenQty: input.receiverWrittenQty,
    receiverWrittenAt: input.receiverWrittenAt,
    receiverWrittenBy: input.receiverName,
    differenceQty
  });
  batch.receiverWrittenQty = input.receiverWrittenQty;
  batch.differenceQty = differenceQty;
  batch.status = differenceQty === 0 ? "\u5DF2\u56DE\u5199" : "\u5DEE\u5F02";
  batch.updatedAt = input.receiverWrittenAt;
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    bag.receiverWrittenQty = input.receivedTransferBagNos.includes(bag.transferBagNo) ? bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0) : 0;
    bag.differenceQty = input.receivedTransferBagNos.includes(bag.transferBagNo) ? 0 : bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0);
    bag.dispatchStatus = differenceQty === 0 ? "\u5DF2\u56DE\u5199" : "\u5DEE\u5F02";
    bag.status = differenceQty === 0 ? "\u5DF2\u56DE\u5199" : "\u5DEE\u5F02";
    bag.packStatus = differenceQty === 0 ? "\u5DF2\u56DE\u5199" : input.receivedTransferBagNos.includes(bag.transferBagNo) ? "\u90E8\u5206\u56DE\u5199" : "\u5DEE\u5F02";
    bag.currentLocation = input.receivedTransferBagNos.includes(bag.transferBagNo) ? "\u4E0B\u6E38\u5DE5\u5382\u5DF2\u63A5\u6536" : "\u5DEE\u5F02\u5F85\u5904\u7406";
    bag.receivedAt = input.receivedTransferBagNos.includes(bag.transferBagNo) ? input.receiverWrittenAt : bag.receivedAt;
    bag.receivedBy = input.receivedTransferBagNos.includes(bag.transferBagNo) ? input.receiverName : bag.receivedBy;
    bag.receivedFeiTicketCount = input.receivedFeiTicketNos.filter((feiTicketNo) => bag.scannedFeiTicketNos.includes(feiTicketNo)).length;
    bag.updatedAt = input.receiverWrittenAt;
  });
  order.receiverWrittenQty = input.receiverWrittenQty;
  order.differenceQty = differenceQty;
  order.status = differenceQty === 0 ? "\u5DF2\u56DE\u5199" : "\u5DEE\u5F02";
  order.updatedAt = input.receiverWrittenAt;
  updateDispatchOrderFromChildren(order);
  return {
    updatedDispatchBatch: clone(batch),
    updatedTransferBags: clone(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId))),
    updatedDispatchOrder: clone(order)
  };
}
function syncSewingQuantityObjectionToDispatch(input) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === input.handoverRecordId);
  if (!batch) throw new Error(`\u672A\u627E\u5230\u4E2D\u8F6C\u5355\u5BF9\u5E94\u4EA4\u51FA\u8BB0\u5F55\uFF1A${input.handoverRecordId}`);
  const order = findDispatchOrderById(storeRef, batch.dispatchOrderId);
  reportPdaHandoverQtyObjection(input.handoverRecordId, {
    objectionReason: input.objectionReason,
    objectionRemark: input.objectionRemark
  });
  syncQuantityObjectionToOutboundRecord({
    handoverRecordId: input.handoverRecordId,
    objectionId: `OBJ-${input.handoverRecordId}`,
    objectionStatus: "\u5904\u7406\u4E2D"
  });
  batch.status = "\u5F02\u8BAE\u4E2D";
  batch.updatedAt = nowText();
  batch.transferBagIds.forEach((bagId) => {
    const bag = findTransferBagById(storeRef, bagId);
    bag.status = "\u5F02\u8BAE\u4E2D";
    bag.dispatchStatus = "\u5F02\u8BAE\u4E2D";
    bag.updatedAt = nowText();
  });
  order.status = "\u5F02\u8BAE\u4E2D";
  order.updatedAt = nowText();
  updateDispatchOrderFromChildren(order);
  return {
    updatedDispatchBatch: clone(batch),
    updatedTransferBags: clone(batch.transferBagIds.map((bagId) => findTransferBagById(storeRef, bagId))),
    updatedDispatchOrder: clone(order)
  };
}
function getCuttingSewingDispatchProgressByProductionOrder(productionOrderId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId);
  const dispatchOrders = storeRef.dispatchOrders.filter((item) => item.productionOrderId === productionOrderId);
  const batches = storeRef.dispatchBatches.filter((batch) => dispatchOrders.some((item) => item.dispatchBatchIds.includes(batch.dispatchBatchId)));
  const bags = storeRef.transferBags.filter((bag) => batches.some((batch) => batch.transferBagIds.includes(bag.transferBagId)));
  const totalProductionQty = order ? getTotalProductionQty(order) : 0;
  const cumulativeDispatchedGarmentQty = sum(
    batches.filter((batch) => batch.status === "\u5DF2\u4EA4\u51FA" || batch.status === "\u5DF2\u56DE\u5199" || batch.status === "\u5DEE\u5F02" || batch.status === "\u5F02\u8BAE\u4E2D").map((batch) => getDispatchBatchSubmittedGarmentQty(storeRef, batch))
  );
  const blockingReasons = unique(
    storeRef.validationResults.filter((item) => item.productionOrderId === productionOrderId && item.blocking).map((item) => item.validationMessage)
  );
  return {
    productionOrderNo: order?.productionOrderNo || productionOrderId,
    totalProductionQty,
    cumulativeDispatchedGarmentQty,
    remainingGarmentQty: Math.max(totalProductionQty - cumulativeDispatchedGarmentQty, 0),
    dispatchBatchCount: batches.length,
    transferBagCount: bags.length,
    dispatchedTransferBagCount: bags.filter((bag) => bag.status === "\u5DF2\u4EA4\u51FA" || bag.status === "\u5DF2\u56DE\u5199" || bag.status === "\u5DEE\u5F02" || bag.status === "\u5F02\u8BAE\u4E2D").length,
    writtenBackTransferBagCount: bags.filter((bag) => bag.status === "\u5DF2\u56DE\u5199").length,
    differenceTransferBagCount: bags.filter((bag) => bag.status === "\u5DEE\u5F02").length,
    objectionTransferBagCount: bags.filter((bag) => bag.status === "\u5F02\u8BAE\u4E2D").length,
    canCreateNextBatch: blockingReasons.length === 0,
    blockingReasons
  };
}
function seedStore() {
  const storeRef = store;
  const pickSeedFeiTicketNos = (batch) => {
    const requiredLines = getRequiredLinesForBag(batch);
    const tickets = listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId: batch.productionOrderId });
    const picked = [];
    requiredLines.forEach((line) => {
      const ticket = tickets.find(
        (item) => !picked.includes(item.feiTicketNo) && item.garmentColor === line.colorName && item.skuSize === line.sizeCode && item.partName === line.partName
      );
      if (ticket) picked.push(ticket.feiTicketNo);
    });
    return picked;
  };
  const markSeedBagAsSortingSample = (transferBagId, operatedAt) => {
    const bag = storeRef.transferBags.find((item) => item.transferBagId === transferBagId);
    if (!bag) return;
    bag.packedBy = "\u88C1\u7247\u4ED3\u5206\u62E3\u5458";
    bag.packedAt = operatedAt;
    bag.lastPackedAt = operatedAt;
    bag.packStatus = bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B";
    bag.status = bag.scannedFeiTicketNos.length ? "\u88C5\u888B\u4E2D" : "\u5F85\u88C5\u888B";
    bag.currentLocation = "\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA";
    bag.contentItems.forEach((item) => {
      item.remark = item.remark || "\u4E8C\u6B21\u5206\u62E3\u6837\u4F8B\uFF1A\u4ECE\u5165\u4ED3\u6682\u5B58\u888B\u91CD\u65B0\u62E3\u51FA\u540E\u88C5\u5165\u672C\u4EA4\u51FA\u8BB0\u5F55\u3002";
    });
    bag.updatedAt = operatedAt;
  };
  const seedProductionOrderId = "PO-202603-0102";
  const readyOrder = createCuttingSewingDispatchOrder({ productionOrderId: seedProductionOrderId, remark: "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\uFF1A\u6309\u5F85\u4EA4\u51FA\u4ED3\u5B9E\u9645\u5E93\u5B58\u5206\u6279\u4EA4\u51FA\u3002" });
  const readyBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: readyOrder.dispatchOrderId,
    plannedSkuQtyLines: [{ colorName: "Navy", colorCode: "Navy", sizeCode: "M", plannedGarmentQty: 356 }]
  });
  const readyBags = createCuttingSewingTransferBags({
    dispatchBatchId: readyBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 356, skuQtyLines: readyBatch.plannedSkuQtyLines }]
  });
  pickSeedFeiTicketNos(readyBatch).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: readyBags[0].transferBagId, feiTicketNo });
  });
  validateDispatchBatchCompleteness(readyBatch.dispatchBatchId);
  const submitResult = submitCuttingSewingDispatchBatch({
    dispatchBatchId: readyBatch.dispatchBatchId,
    operatorName: "\u88C1\u5E8A\u4EA4\u51FA\u5458",
    submittedAt: "2026-04-23 10:20:00"
  });
  syncSewingReceiveWritebackToDispatch({
    handoverRecordId: submitResult.handoverRecord.handoverRecordId || submitResult.handoverRecord.recordId,
    receiverWrittenQty: submitResult.handoverRecord.submittedQty || 0,
    receivedTransferBagNos: readyBags.map((bag) => bag.transferBagNo),
    receivedFeiTicketNos: readyBags.flatMap((bag) => bag.scannedFeiTicketNos),
    receiverName: "\u8F66\u7F1D\u63A5\u6536\u5458",
    receiverWrittenAt: "2026-04-23 11:00:00"
  });
  const secondBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: readyOrder.dispatchOrderId,
    plannedSkuQtyLines: [{ colorName: "Khaki", colorCode: "Khaki", sizeCode: "L", plannedGarmentQty: 368 }]
  });
  const secondBags = createCuttingSewingTransferBags({
    dispatchBatchId: secondBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 368, skuQtyLines: secondBatch.plannedSkuQtyLines }]
  });
  pickSeedFeiTicketNos(secondBatch).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: secondBags[0].transferBagId, feiTicketNo });
  });
  validateDispatchBatchCompleteness(secondBatch.dispatchBatchId);
  submitCuttingSewingDispatchBatch({
    dispatchBatchId: secondBatch.dispatchBatchId,
    operatorName: "\u88C1\u5E8A\u4EA4\u51FA\u5458",
    submittedAt: "2026-04-24 09:30:00"
  });
  const pendingBatch = createCuttingSewingDispatchBatch({
    dispatchOrderId: readyOrder.dispatchOrderId,
    plannedSkuQtyLines: [{ colorName: "Navy", colorCode: "Navy", sizeCode: "S", plannedGarmentQty: 201 }]
  });
  const pendingBags = createCuttingSewingTransferBags({
    dispatchBatchId: pendingBatch.dispatchBatchId,
    bagPlanList: [{ plannedGarmentQty: 201, skuQtyLines: pendingBatch.plannedSkuQtyLines }]
  });
  pickSeedFeiTicketNos(pendingBatch).slice(0, 1).forEach((feiTicketNo) => {
    scanFeiTicketIntoTransferBag({ transferBagId: pendingBags[0].transferBagId, feiTicketNo });
  });
  validateDispatchBatchCompleteness(pendingBatch.dispatchBatchId);
  markSeedBagAsSortingSample(pendingBags[0].transferBagId, "2026-04-24 14:20:00");
  const partialSource = listAvailableFeiTicketsForSewingDispatchInternal({ productionOrderId: seedProductionOrderId })[0];
  if (partialSource) {
    const partialBatch = createCuttingSewingDispatchBatch({
      dispatchOrderId: readyOrder.dispatchOrderId,
      plannedSkuQtyLines: [
        {
          colorName: partialSource.garmentColor,
          colorCode: partialSource.garmentColor,
          sizeCode: partialSource.skuSize,
          plannedGarmentQty: Math.max(partialSource.garmentQty || 1, 1)
        }
      ]
    });
    const partialBags = createCuttingSewingTransferBags({
      dispatchBatchId: partialBatch.dispatchBatchId,
      bagPlanList: [{ plannedGarmentQty: partialBatch.plannedGarmentQty, skuQtyLines: partialBatch.plannedSkuQtyLines }]
    });
    scanFeiTicketIntoTransferBag({ transferBagId: partialBags[0].transferBagId, feiTicketNo: partialSource.feiTicketNo });
    validateDispatchBatchCompleteness(partialBatch.dispatchBatchId);
    const partialBag = storeRef.transferBags.find((item) => item.transferBagId === partialBags[0].transferBagId);
    if (partialBag?.scannedFeiTicketNos.length) {
      partialBag.contentItems.forEach((item) => {
        item.remark = item.remark || "\u90E8\u5206\u4EA4\u51FA\u6837\u4F8B\uFF1A\u672C\u6B21\u53EA\u4EA4\u51FA\u5DF2\u88C1\u51FA\u88C1\u7247\uFF0C\u63D0\u4EA4\u540E\u7EE7\u7EED\u5C55\u793A\u7F3A\u53E3\u3002";
      });
      submitCuttingSewingDispatchBatch({
        dispatchBatchId: partialBatch.dispatchBatchId,
        operatorName: "\u88C1\u5E8A\u4EA4\u51FA\u5458",
        submittedAt: "2026-04-25 09:10:00"
      });
    }
  }
  void storeRef;
}
function ensureCuttingSewingDispatchSeeded() {
  if (!store) {
    store = {
      dispatchOrders: [],
      dispatchBatches: [],
      transferBags: [],
      validationResults: []
    };
    seedStore();
  }
  return store;
}
function listCuttingSewingDispatchOrders() {
  return clone(ensureCuttingSewingDispatchSeeded().dispatchOrders);
}
function listCuttingSewingDispatchBatches() {
  return clone(ensureCuttingSewingDispatchSeeded().dispatchBatches);
}
function getCuttingSewingDispatchBatchHandoverSummary(dispatchBatchId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = storeRef.dispatchBatches.find((item) => item.dispatchBatchId === dispatchBatchId);
  if (!batch) return null;
  const order = storeRef.dispatchOrders.find((item) => item.dispatchOrderId === batch.dispatchOrderId);
  if (!order) return null;
  const submittedPieceQty = getDispatchBatchPieceQty(storeRef, batch);
  return clone(buildCuttingHandoverRecordSummary(storeRef, order, batch, submittedPieceQty));
}
function listCuttingSewingTransferBags() {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  storeRef.transferBags.forEach(normalizeTransferBagRuntimeFields);
  return clone(storeRef.transferBags);
}
function listCuttingSewingDispatchValidationResults() {
  return clone(ensureCuttingSewingDispatchSeeded().validationResults);
}
function findCuttingSewingDispatchByFeiTicketNo(feiTicketNo) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const bag = storeRef.transferBags.find((item) => item.scannedFeiTicketNos.includes(feiTicketNo));
  if (bag) normalizeTransferBagRuntimeFields(bag);
  const batch = bag ? storeRef.dispatchBatches.find((item) => item.dispatchBatchId === bag.dispatchBatchId) : void 0;
  const order = batch ? storeRef.dispatchOrders.find((item) => item.dispatchOrderId === batch.dispatchOrderId) : void 0;
  const specialCraft = mapSpecialCraftReturnStatus(feiTicketNo);
  const status = bag?.status === "\u5DF2\u56DE\u5199" ? "\u5DF2\u56DE\u5199" : bag?.status === "\u5DEE\u5F02" ? "\u5DEE\u5F02" : bag?.status === "\u5F02\u8BAE\u4E2D" ? "\u5F02\u8BAE\u4E2D" : bag?.status === "\u5DF2\u4EA4\u51FA" ? "\u5DF2\u4EA4\u51FA" : bag ? "\u5DF2\u88C5\u888B" : "\u672A\u88C5\u888B";
  return {
    dispatchOrder: order ? clone(order) : void 0,
    dispatchBatch: batch ? clone(batch) : void 0,
    transferBag: bag ? clone(bag) : void 0,
    feiTicketSewingStatus: status,
    specialCraftReturnStatus: specialCraft.specialCraftReturnStatus
  };
}
function getCuttingSewingDispatchByHandoverRecordId(handoverRecordId) {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  const batch = storeRef.dispatchBatches.find((item) => item.handoverRecordId === handoverRecordId);
  if (!batch) return { transferBags: [] };
  const order = storeRef.dispatchOrders.find((item) => item.dispatchOrderId === batch.dispatchOrderId);
  return {
    dispatchOrder: order ? clone(order) : void 0,
    dispatchBatch: clone(batch),
    transferBags: clone(storeRef.transferBags.filter((bag) => {
      const matched = batch.transferBagIds.includes(bag.transferBagId);
      if (matched) normalizeTransferBagRuntimeFields(bag);
      return matched;
    }))
  };
}
function getCuttingSewingDispatchSummary() {
  const storeRef = ensureCuttingSewingDispatchSeeded();
  return {
    waitingCompleteOrderCount: storeRef.dispatchOrders.filter((order) => order.status === "\u5F85\u6838\u5BF9" || order.status === "\u5F85\u626B\u7801").length,
    readyBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === "\u5DF2\u6838\u5BF9").length,
    handedOverBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === "\u5DF2\u4EA4\u51FA").length,
    writtenBackBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === "\u5DF2\u56DE\u5199").length,
    differenceBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === "\u5DEE\u5F02").length,
    objectionBatchCount: storeRef.dispatchBatches.filter((batch) => batch.status === "\u5F02\u8BAE\u4E2D").length,
    remainingGarmentQty: sum(storeRef.dispatchOrders.map((order) => order.remainingGarmentQty))
  };
}
export {
  assertSewingDispatchAllowed,
  assertTransferBagEditableBeforeHandover,
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildRequiredCutPiecesForSewingDispatch,
  buildSewingTaskAllocationProjectionFromInventory,
  createCuttingSewingDispatchBatch,
  createCuttingSewingDispatchOrder,
  createCuttingSewingTransferBags,
  createOrGetTransferBagForDispatchBatch,
  ensureCuttingSewingDispatchSeeded,
  finalizeCombinedSewingWriteback,
  findCuttingSewingDispatchByFeiTicketNo,
  getCuttingSewingDispatchBatchHandoverSummary,
  getCuttingSewingDispatchByHandoverRecordId,
  getCuttingSewingDispatchProgressByProductionOrder,
  getCuttingSewingDispatchSummary,
  getEligibleFeiTicketsForSewingDispatch,
  getTransferBagContentDisplayItems,
  getTransferBagScanSummaryByQr,
  listAvailableCutPieceInventoryForSewingDispatch,
  listAvailableFeiTicketsForSewingDispatch,
  listAvailableSkuInventoryForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingDispatchValidationResults,
  listCuttingSewingTransferBags,
  recalcTransferBagContentSummary,
  removeFeiTicketFromTransferBag,
  removeTransferBagContentItemBeforeHandover,
  scanFeiTicketIntoTransferBag,
  scanFeiTicketIntoTransferBagOnMobile,
  submitCuttingSewingDispatchBatch,
  syncSewingQuantityObjectionToDispatch,
  syncSewingReceiveWritebackToDispatch,
  validateDispatchBatchCompleteness,
  validateTransferBagCompleteness,
  validateTransferBagForMixedPacking,
  writebackSewingReceiveByFeiTicket,
  writebackSewingReceiveByTransferBag
};
