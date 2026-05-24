import {
  buildCuttingTraceabilityId,
  encodeCarrierQr
} from "../../../data/fcs/cutting/qr-codes.ts";
import {
  normalizeCarrierCycleItemBinding,
  normalizeTransferBagDispatchManifest,
  normalizeTransferCarrierCycleRecord,
  normalizeTransferCarrierRecord
} from "../../../data/fcs/cutting/transfer-carrier-normalizer.ts";
import {
  buildSystemSeedTransferBagRuntime,
  createCarrierCycleRecord,
  createCarrierDispatchManifest,
  deserializeTransferBagRuntimeStorage,
  mergeTransferBagRuntimeStores,
  serializeTransferBagRuntimeStorage
} from "../../../data/fcs/cutting/transfer-bag-runtime.ts";
import {
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingTransferBags
} from "../../../data/fcs/cutting/sewing-dispatch.ts";
import {
  getFactoryMasterRecordById
} from "../../../data/fcs/factory-master-store.ts";
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from "../../../data/fcs/factory-mock-data.ts";
import { FEI_TICKET_DEMO_CASE_IDS } from "./fei-tickets-model.ts";
import {
  buildSpreadingTraceAnchors,
  findSpreadingTraceAnchor
} from "./marker-spreading-model.ts";
const numberFormatter = new Intl.NumberFormat("zh-CN");
const TRANSFER_QR_FIELD = ["qr", "Payload"].join("");
const INBOUND_TEMP_BAG_RULE_LABEL = "\u5165\u4ED3\u6682\u5B58\u888B\u53EF\u6DF7\u88C5\u4E0D\u540C\u751F\u4EA7\u5355\u3001SKU\u3001\u90E8\u4F4D\u7684\u83F2\u7968\uFF1B\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u540E\u518D\u4E8C\u6B21\u5206\u62E3\u3002";
const HANDOVER_PACKING_BAG_RULE_LABEL = "\u4EA4\u51FA\u88C5\u888B\u9700\u5148\u626B\u4E2D\u8F6C\u888B\uFF0C\u518D\u626B\u83F2\u7968\u5B50\u7801\uFF1B\u672C\u9636\u6BB5\u624D\u6309\u4EA4\u51FA\u5355\u5173\u7CFB\u6838\u5BF9\u3002";
function normalizeTransferBagUsageStage(stage) {
  return stage === "INBOUND_TEMP" ? "INBOUND_TEMP" : "HANDOVER_PACKING";
}
function getTransferBagUsageStageLabel(stage) {
  return normalizeTransferBagUsageStage(stage) === "INBOUND_TEMP" ? "\u5165\u4ED3\u6682\u5B58" : "\u4EA4\u51FA\u88C5\u888B";
}
function getTransferBagRuleLabel(stage) {
  return normalizeTransferBagUsageStage(stage) === "INBOUND_TEMP" ? INBOUND_TEMP_BAG_RULE_LABEL : HANDOVER_PACKING_BAG_RULE_LABEL;
}
function isInboundTempTransferBagUsage(usage) {
  return normalizeTransferBagUsageStage(usage?.usageStage) === "INBOUND_TEMP";
}
function readTransferQrMeta(master) {
  const pageMaster = master;
  const storedValue = pageMaster[TRANSFER_QR_FIELD];
  if (storedValue && typeof storedValue === "object") {
    return storedValue;
  }
  if (master.qrMeta && typeof master.qrMeta === "object") {
    return master.qrMeta;
  }
  return null;
}
function readRuntimeTransferQrMeta(master) {
  const runtimeRecord = master;
  const runtimeValue = runtimeRecord[TRANSFER_QR_FIELD];
  if (runtimeValue && typeof runtimeValue === "object") {
    return runtimeValue;
  }
  return {};
}
function assignTransferQrMeta(target, value) {
  target[TRANSFER_QR_FIELD] = value;
}
function resolveTransferBagFactoryName(factoryId, fallbackName) {
  if (factoryId) {
    const factory = getFactoryMasterRecordById(factoryId);
    if (factory?.name) return factory.name;
  }
  return fallbackName?.trim() || "\u5DE5\u5382\u6863\u6848\u5F85\u8865";
}
function pickTransferBagSewingFactory(index) {
  return {
    factoryId: TEST_FACTORY_ID,
    factoryName: TEST_FACTORY_NAME
  };
}
const CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY = "cuttingTransferBagLedger";
const CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY = "cuttingTransferBagSelectedTicketRecordIds";
function getTransferBagDemoCaseIds() {
  return {
    CASE_F: {
      pocketId: "bag-master-005",
      pocketNo: "BAG-C-002",
      usageId: "seed-usage-case-f",
      usageNo: "TBU-DEMO-F-001",
      lockedTicketId: FEI_TICKET_DEMO_CASE_IDS.CASE_C.sampleTicketId,
      lockedTicketNo: FEI_TICKET_DEMO_CASE_IDS.CASE_C.sampleTicketNo,
      mismatchTicketId: "ticket-CUT-260301-005-01-002-v1",
      mismatchTicketNo: "FT-CUT-260301-005-01-002"
    }
  };
}
const masterStatusMetaMap = {
  IDLE: {
    label: "\u7A7A\u95F2",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u672A\u8FDB\u5165\u4F7F\u7528\u5468\u671F\uFF0C\u53EF\u7EE7\u7EED\u88C5\u888B\u3002"
  },
  IN_USE: {
    label: "\u4F7F\u7528\u4E2D",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u6709\u4F7F\u7528\u5468\u671F\uFF0C\u4ECD\u5904\u4E8E\u88C5\u888B\u6216\u5F85\u53D1\u51FA\u9636\u6BB5\u3002"
  },
  DISPATCHED: {
    label: "\u5DF2\u53D1\u51FA",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u53D1\u5F80\u8F66\u7F1D\u4EFB\u52A1\u5BF9\u5E94\u5DE5\u5382\u3002"
  },
  WAITING_SIGNOFF: {
    label: "\u5F85\u7B7E\u6536",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u5230\u53D1\u51FA\u9636\u6BB5\uFF0C\u7B49\u5F85\u540E\u9053\u7B7E\u6536\u786E\u8BA4\u3002"
  },
  WAITING_RETURN: {
    label: "\u5F85\u56DE\u4ED3",
    className: "bg-orange-100 text-orange-700 border border-orange-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u5B8C\u6210\u53D1\u51FA\u94FE\u8DEF\uFF0C\u7B49\u5F85\u56DE\u8D27\u5165\u4ED3\u3002"
  },
  RETURN_INSPECTING: {
    label: "\u56DE\u4ED3\u9A8C\u6536\u4E2D",
    className: "bg-cyan-100 text-cyan-700 border border-cyan-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u8FDB\u5165\u56DE\u8D27\u9A8C\u6536\uFF0C\u7B49\u5F85\u888B\u51B5\u4E0E\u5DEE\u5F02\u786E\u8BA4\u3002"
  },
  REUSABLE: {
    label: "\u53EF\u590D\u7528",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u5B8C\u6210\u672C\u8F6E\u4F7F\u7528\u5468\u671F\u95ED\u73AF\uFF0C\u53EF\u7EE7\u7EED\u590D\u7528\u3002"
  },
  WAITING_CLEANING: {
    label: "\u5F85\u6E05\u6D01",
    className: "bg-sky-100 text-sky-700 border border-sky-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u8FD4\u4ED3\uFF0C\u4F46\u9700\u6E05\u6D01\u540E\u624D\u80FD\u518D\u6B21\u590D\u7528\u3002"
  },
  WAITING_REPAIR: {
    label: "\u5F85\u7EF4\u4FEE",
    className: "bg-rose-100 text-rose-700 border border-rose-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5B58\u5728\u635F\u574F\uFF0C\u9700\u8981\u7EF4\u4FEE\u786E\u8BA4\u540E\u518D\u51B3\u5B9A\u662F\u5426\u590D\u7528\u3002"
  },
  DISABLED: {
    label: "\u505C\u7528 / \u62A5\u5E9F",
    className: "bg-slate-200 text-slate-700 border border-slate-300",
    detailText: "\u5F53\u524D\u53E3\u888B\u4E0D\u518D\u8FDB\u5165\u590D\u7528\u94FE\u8DEF\uFF0C\u4EC5\u4FDD\u7559\u5468\u671F\u53F0\u8D26\u8FFD\u6EAF\u3002"
  }
};
const pocketCarrierStatusMetaMap = {
  IDLE: {
    label: "\u7A7A\u95F2",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u4F7F\u7528\u5468\u671F\uFF0C\u53EF\u76F4\u63A5\u5F00\u59CB\u88C5\u888B\u3002"
  },
  PACKING: {
    label: "\u88C5\u888B\u4E2D",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u8FDB\u5165\u4F7F\u7528\u5468\u671F\uFF0C\u4ECD\u53EF\u7EE7\u7EED\u626B\u63CF\u83F2\u7968\u5E76\u8C03\u6574\u888B\u5185\u660E\u7EC6\u3002"
  },
  READY_TO_DISPATCH: {
    label: "\u5F85\u53D1\u51FA",
    className: "bg-violet-100 text-violet-700 border border-violet-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u5B8C\u6210\u88C5\u888B\uFF0C\u7B49\u5F85\u6253\u5370\u88C5\u888B\u6E05\u5355\u5E76\u53D1\u51FA\u3002"
  },
  DISPATCHED: {
    label: "\u5DF2\u53D1\u51FA",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u53D1\u5F80\u4E0B\u6E38\uFF0C\u7B49\u5F85\u7B7E\u6536\u3002"
  },
  SIGNED: {
    label: "\u5DF2\u7B7E\u6536",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u5B8C\u6210\u7B7E\u6536\uFF0C\u7B49\u5F85\u56DE\u4ED3\u4E0E\u9A8C\u6536\u3002"
  },
  RETURNED: {
    label: "\u5DF2\u56DE\u4ED3",
    className: "bg-cyan-100 text-cyan-700 border border-cyan-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u56DE\u4ED3\uFF0C\u7B49\u5F85\u5173\u95ED\u4F7F\u7528\u5468\u671F\u5E76\u91CA\u653E\u590D\u7528\u3002"
  },
  DISABLED: {
    label: "\u505C\u7528",
    className: "bg-rose-100 text-rose-700 border border-rose-200",
    detailText: "\u5F53\u524D\u53E3\u888B\u5DF2\u505C\u7528\uFF0C\u4E0D\u53EF\u7EE7\u7EED\u8FDB\u5165\u88C5\u888B\u6D41\u7A0B\u3002"
  }
};
const usageStatusMetaMap = {
  DRAFT: {
    label: "\u8349\u7A3F",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u4EC5\u5B8C\u6210\u53E3\u888B\u4E0E\u4EFB\u52A1\u8349\u7A3F\u7ED1\u5B9A\u3002"
  },
  PACKING: {
    label: "\u88C5\u888B\u4E2D",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u6B63\u5728\u6301\u7EED\u5EFA\u7ACB\u7236\u5B50\u7801\u6620\u5C04\u3002"
  },
  READY_TO_DISPATCH: {
    label: "\u5F85\u53D1\u51FA",
    className: "bg-violet-100 text-violet-700 border border-violet-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u5B8C\u6210\u88C5\u888B\uFF0C\u53EF\u6253\u5370\u4EA4\u63A5\u6E05\u5355\u5E76\u53D1\u51FA\u3002"
  },
  DISPATCHED: {
    label: "\u5DF2\u53D1\u51FA",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u53D1\u51FA\uFF0C\u4F46\u5C1A\u672A\u8FDB\u5165\u56DE\u8D27\u95ED\u73AF\u3002"
  },
  PENDING_SIGNOFF: {
    label: "\u5F85\u7B7E\u6536",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u5230\u5F85\u7B7E\u6536\u72B6\u6001\uFF0C\u540E\u7EED\u8FDB\u5165\u56DE\u8D27\u4E0E\u590D\u7528\u5904\u7406\u3002"
  },
  WAITING_RETURN: {
    label: "\u5F85\u56DE\u4ED3",
    className: "bg-orange-100 text-orange-700 border border-orange-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u5230\u56DE\u8D27\u524D\u7F6E\u9636\u6BB5\uFF0C\u7B49\u5F85\u8FD4\u4ED3\u3002"
  },
  RETURN_INSPECTING: {
    label: "\u56DE\u4ED3\u9A8C\u6536\u4E2D",
    className: "bg-cyan-100 text-cyan-700 border border-cyan-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u8FDB\u5165\u56DE\u8D27\u9A8C\u6536\u4E0E\u888B\u51B5\u786E\u8BA4\u3002"
  },
  CLOSED: {
    label: "\u5DF2\u5173\u95ED",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u5B8C\u6210\u56DE\u8D27\u9A8C\u6536\u5E76\u6B63\u5F0F\u5173\u95ED\u3002"
  },
  EXCEPTION_CLOSED: {
    label: "\u5F02\u5E38\u5173\u95ED",
    className: "bg-rose-100 text-rose-700 border border-rose-200",
    detailText: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5728\u5B58\u5728\u5DEE\u5F02\u6216\u888B\u51B5\u5F02\u5E38\u65F6\u5E26\u8BF4\u660E\u5173\u95ED\u3002"
  }
};
const visibleStatusMetaMap = {
  IDLE: {
    label: "\u7A7A\u95F2",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u5F53\u524D\u6CA1\u6709\u6253\u5F00\u4E2D\u7684\u5468\u8F6C\uFF0C\u53EF\u7EE7\u7EED\u5F00\u59CB\u88C5\u888B\u3002"
  },
  IN_PROGRESS: {
    label: "\u4F7F\u7528\u4E2D",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    detailText: "\u5F53\u524D\u6B63\u5728\u626B\u7801\u88C5\u888B\uFF0C\u5C1A\u672A\u5B8C\u6210\u6838\u5BF9\u3002"
  },
  READY_HANDOVER: {
    label: "\u5F85\u4EA4\u51FA",
    className: "bg-violet-100 text-violet-700 border border-violet-200",
    detailText: "\u5F53\u524D\u5DF2\u5B8C\u6210\u88C5\u888B\uFF0C\u7B49\u5F85\u88C1\u7247\u4ED3\u4EA4\u51FA\u3002"
  },
  HANDED_OVER: {
    label: "\u5DF2\u4EA4\u51FA",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u5F53\u524D\u5DF2\u4ECE\u88C1\u7247\u4ED3\u4EA4\u51FA\uFF0C\u7B49\u5F85\u540E\u7EED\u56DE\u6536\u3002"
  },
  ARCHIVED: {
    label: "\u5F52\u6863",
    className: "bg-slate-200 text-slate-700 border border-slate-300",
    detailText: "\u5F53\u524D\u53E3\u888B\u4E0D\u53EF\u7EE7\u7EED\u4F7F\u7528\uFF0C\u4EC5\u4FDD\u7559\u8FFD\u6EAF\u8BB0\u5F55\u3002"
  }
};
function createMeta(key, config) {
  return {
    key,
    label: config.label,
    className: config.className,
    detailText: config.detailText
  };
}
function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function getTransferBagTicketPrintStatusLabel(ticket) {
  if (!ticket) return "\u672A\u77E5";
  if (ticket.ticketStatus === "VOIDED" || ticket.printStatus === "VOIDED") return "\u5DF2\u4F5C\u5E9F";
  if (ticket.ticketStatus === "PRINTED") return ticket.printStatus === "REPRINTED" ? "\u5DF2\u8865\u6253" : "\u5DF2\u9996\u6253";
  if (ticket.printStatus === "WAIT_PRINT") return "\u672A\u9996\u6253";
  if (ticket.printStatus === "REPRINTED") return "\u5DF2\u8865\u6253";
  return "\u5DF2\u9996\u6253";
}
function buildBagAuditId(nowText, usageId, action) {
  return buildCuttingTraceabilityId("bag-audit", nowText, usageId, action);
}
function toCarrierType(bagCode, explicit) {
  if (explicit === "box" || explicit === "bag") return explicit;
  return bagCode.startsWith("BOX") ? "box" : "bag";
}
function toPageMasterStatus(status) {
  const normalized = String(status || "IDLE").toUpperCase();
  if (normalized === "IDLE" || normalized === "IN_USE" || normalized === "DISPATCHED" || normalized === "WAITING_SIGNOFF" || normalized === "WAITING_RETURN" || normalized === "RETURN_INSPECTING" || normalized === "REUSABLE" || normalized === "WAITING_CLEANING" || normalized === "WAITING_REPAIR" || normalized === "DISABLED") {
    return normalized;
  }
  return "IDLE";
}
function toPageUsageStatus(status) {
  const normalized = String(status || "DRAFT").toUpperCase();
  if (normalized === "DRAFT" || normalized === "PACKING" || normalized === "READY_TO_DISPATCH" || normalized === "DISPATCHED" || normalized === "PENDING_SIGNOFF" || normalized === "WAITING_RETURN" || normalized === "RETURN_INSPECTING" || normalized === "CLOSED" || normalized === "EXCEPTION_CLOSED") {
    return normalized;
  }
  return "DRAFT";
}
function toRuntimeCarrierRecord(master) {
  const normalized = normalizeTransferCarrierRecord(master);
  const carrierId = normalized.carrierId;
  const carrierCode = normalized.carrierCode;
  const carrierType = toCarrierType(carrierCode, master.carrierType);
  const encoded = encodeCarrierQr({
    carrierId,
    carrierCode,
    carrierType,
    cycleId: master.currentCycleId || "idle-cycle",
    issuedAt: "2026-03-24 08:00"
  });
  return {
    carrierId,
    carrierCode,
    carrierType,
    bagType: master.bagType,
    capacity: master.capacity,
    reusable: master.reusable,
    currentStatus: master.currentStatus,
    currentLocation: master.currentLocation,
    latestCycleId: normalized.latestCycleId,
    latestCycleNo: normalized.latestCycleNo,
    currentCycleId: normalized.currentCycleId,
    currentOwnerTaskId: normalized.currentOwnerTaskId,
    note: master.note,
    qrMeta: readTransferQrMeta(master) || encoded.payload,
    qrValue: master.qrValue || encoded.qrValue
  };
}
function toPageMaster(master) {
  const pageMaster = {
    carrierId: master.carrierId,
    carrierCode: master.carrierCode,
    carrierType: master.carrierType,
    latestCycleId: master.latestCycleId || "",
    latestCycleNo: master.latestCycleNo || "",
    bagId: master.carrierId,
    bagCode: master.carrierCode,
    bagType: master.bagType,
    capacity: master.capacity,
    reusable: master.reusable,
    currentStatus: toPageMasterStatus(master.currentStatus),
    currentLocation: master.currentLocation,
    latestUsageId: master.latestCycleId || "",
    latestUsageNo: master.latestCycleNo || "",
    currentCycleId: master.currentCycleId || "",
    currentOwnerTaskId: master.currentOwnerTaskId || "",
    qrValue: master.qrValue,
    qrMeta: readRuntimeTransferQrMeta(master),
    note: master.note
  };
  assignTransferQrMeta(pageMaster, readRuntimeTransferQrMeta(master));
  return pageMaster;
}
function toRuntimeUsage(usage) {
  const normalized = normalizeTransferCarrierCycleRecord(usage);
  return {
    cycleId: normalized.cycleId,
    cycleNo: normalized.cycleNo,
    carrierId: normalized.carrierId,
    carrierCode: normalized.carrierCode,
    carrierType: normalized.carrierType,
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    sewingFactoryId: usage.sewingFactoryId,
    sewingFactoryName: usage.sewingFactoryName,
    styleCode: usage.styleCode,
    spuCode: usage.spuCode,
    skuSummary: usage.skuSummary,
    colorSummary: usage.colorSummary,
    sizeSummary: usage.sizeSummary,
    cycleStatus: normalized.cycleStatus,
    status: String(usage.status || ""),
    packedTicketCount: usage.packedTicketCount,
    packedCutOrderCount: usage.packedCutOrderCount,
    startedAt: usage.startedAt || "",
    finishedPackingAt: usage.finishedPackingAt || "",
    dispatchAt: usage.dispatchAt,
    dispatchBy: usage.dispatchBy,
    signoffStatus: usage.signoffStatus,
    signedAt: usage.signedAt || "",
    returnedAt: usage.returnedAt || "",
    usageStage: normalizeTransferBagUsageStage(usage.usageStage),
    usageStageLabel: usage.usageStageLabel || getTransferBagUsageStageLabel(usage.usageStage),
    note: usage.note
  };
}
function toPageUsage(usage) {
  const usageStage = normalizeTransferBagUsageStage(usage.usageStage);
  return {
    cycleId: usage.cycleId,
    cycleNo: usage.cycleNo,
    carrierId: usage.carrierId,
    carrierCode: usage.carrierCode,
    carrierType: usage.carrierType,
    usageId: usage.cycleId,
    usageNo: usage.cycleNo,
    bagId: usage.carrierId,
    bagCode: usage.carrierCode,
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    sewingFactoryId: usage.sewingFactoryId,
    sewingFactoryName: usage.sewingFactoryName,
    styleCode: usage.styleCode,
    spuCode: usage.spuCode,
    skuSummary: usage.skuSummary,
    colorSummary: usage.colorSummary,
    sizeSummary: usage.sizeSummary,
    cycleStatus: toPageUsageStatus(usage.cycleStatus),
    usageStatus: toPageUsageStatus(usage.cycleStatus),
    packedTicketCount: usage.packedTicketCount || 0,
    packedCutOrderCount: usage.packedCutOrderCount || 0,
    startedAt: usage.startedAt || "",
    finishedPackingAt: usage.finishedPackingAt || "",
    dispatchAt: usage.dispatchAt || "",
    dispatchBy: usage.dispatchBy || "",
    signoffStatus: usage.signoffStatus || "PENDING",
    signedAt: usage.signedAt || "",
    returnedAt: usage.returnedAt || "",
    status: usage.status,
    usageStage,
    usageStageLabel: usage.usageStageLabel || getTransferBagUsageStageLabel(usageStage),
    note: usage.note
  };
}
function toRuntimeBinding(binding) {
  const cycleKey = binding.cycleId;
  const normalized = normalizeCarrierCycleItemBinding(binding, {
    [cycleKey]: binding
  });
  return {
    bindingId: binding.bindingId,
    cycleId: normalized.cycleId,
    cycleNo: normalized.cycleNo,
    carrierId: normalized.carrierId,
    carrierCode: normalized.carrierCode,
    feiTicketId: normalized.feiTicketId,
    feiTicketNo: normalized.feiTicketNo,
    cutOrderId: binding.cutOrderId,
    cutOrderNo: binding.cutOrderNo,
    productionOrderNo: binding.productionOrderNo,
    markerPlanNo: binding.markerPlanNo,
    fabricRollNo: binding.fabricRollNo || "",
    fabricColor: binding.fabricColor || "",
    size: binding.size || "",
    partCode: binding.ticket?.partCode || "",
    partName: binding.partName || "",
    bundleNo: binding.bundleNo || "",
    qty: binding.qty,
    actualCutPieceQty: binding.actualCutPieceQty ?? binding.qty,
    garmentQty: binding.garmentQty ?? binding.qty,
    boundAt: binding.boundAt,
    boundBy: binding.boundBy,
    operator: normalized.operator,
    status: normalized.status,
    note: binding.note
  };
}
function toPageBinding(binding) {
  return {
    bindingId: binding.bindingId,
    cycleId: binding.cycleId,
    cycleNo: binding.cycleNo,
    carrierId: binding.carrierId,
    carrierCode: binding.carrierCode,
    feiTicketId: binding.feiTicketId,
    feiTicketNo: binding.feiTicketNo,
    usageId: binding.cycleId,
    usageNo: binding.cycleNo,
    bagId: binding.carrierId,
    bagCode: binding.carrierCode,
    ticketRecordId: binding.feiTicketId,
    ticketNo: binding.feiTicketNo,
    cutOrderId: binding.cutOrderId,
    cutOrderNo: binding.cutOrderNo,
    productionOrderNo: binding.productionOrderNo,
    markerPlanNo: binding.markerPlanNo,
    \u551B\u67B6\u65B9\u6848No: binding.markerPlanNo,
    fabricRollNo: binding.fabricRollNo || "",
    fabricColor: binding.fabricColor || "",
    size: binding.size || "",
    partName: binding.partName || "",
    bundleNo: binding.bundleNo || "",
    qty: binding.qty,
    garmentQty: binding.garmentQty ?? binding.qty,
    actualCutPieceQty: binding.actualCutPieceQty ?? binding.qty,
    boundAt: binding.boundAt,
    boundBy: binding.boundBy,
    operator: binding.operator || binding.boundBy,
    status: binding.status || "BOUND",
    note: binding.note
  };
}
function toRuntimeManifest(manifest) {
  const normalized = normalizeTransferBagDispatchManifest(manifest);
  return {
    manifestId: manifest.manifestId,
    cycleId: normalized.cycleId,
    carrierCode: normalized.carrierCode,
    sewingTaskNo: manifest.sewingTaskNo,
    sewingFactoryName: manifest.sewingFactoryName,
    ticketCount: manifest.ticketCount,
    cutOrderCount: manifest.cutOrderCount,
    createdAt: manifest.createdAt,
    createdBy: manifest.createdBy,
    printStatus: manifest.printStatus,
    note: manifest.note
  };
}
function toPageManifest(manifest) {
  return {
    manifestId: manifest.manifestId,
    cycleId: manifest.cycleId,
    carrierCode: manifest.carrierCode,
    usageId: manifest.cycleId,
    bagCode: manifest.carrierCode,
    sewingTaskNo: manifest.sewingTaskNo,
    sewingFactoryName: manifest.sewingFactoryName,
    ticketCount: manifest.ticketCount,
    cutOrderCount: manifest.cutOrderCount,
    createdAt: manifest.createdAt,
    createdBy: manifest.createdBy,
    printStatus: manifest.printStatus,
    note: manifest.note
  };
}
function toRuntimeStore(store) {
  return {
    masters: store.masters.map((item) => toRuntimeCarrierRecord(item)),
    usages: store.usages.map((item) => toRuntimeUsage(item)),
    bindings: store.bindings.map((item) => toRuntimeBinding(item)),
    manifests: store.manifests.map((item) => toRuntimeManifest(item)),
    sewingTasks: store.sewingTasks.map((item) => ({ ...item })),
    auditTrail: store.auditTrail.map((item) => ({ ...item })),
    returnReceipts: store.returnReceipts.map((item) => ({ ...item })),
    conditionRecords: store.conditionRecords.map((item) => ({ ...item })),
    reuseCycles: store.reuseCycles.map((item) => ({ ...item })),
    closureResults: store.closureResults.map((item) => ({ ...item })),
    returnAuditTrail: store.returnAuditTrail.map((item) => ({ ...item }))
  };
}
function toPageStore(store) {
  return {
    masters: store.masters.map((item) => toPageMaster(item)),
    usages: store.usages.map((item) => toPageUsage(item)),
    bindings: store.bindings.map((item) => toPageBinding(item)),
    manifests: store.manifests.map((item) => toPageManifest(item)),
    sewingTasks: store.sewingTasks.map((item) => ({ ...item })),
    auditTrail: store.auditTrail,
    returnReceipts: store.returnReceipts,
    conditionRecords: store.conditionRecords,
    reuseCycles: store.reuseCycles,
    closureResults: store.closureResults,
    returnAuditTrail: store.returnAuditTrail
  };
}
function toRuntimeSeedCutOrderRows(rows) {
  return rows.map((row) => ({
    cutOrderId: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
    productionOrderNo: row.productionOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    color: row.color,
    materialSku: row.materialSku,
    plannedQty: row.plannedQty,
    orderQty: row.orderQty
  }));
}
function toRuntimeSeedMarkerPlanRefs(batches) {
  return batches.map((batch) => ({
    markerPlanId: batch.markerPlanId,
    markerPlanNo: batch.markerPlanNo,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    materialSkuSummary: batch.materialSkuSummary,
    items: batch.items.map((item) => ({
      cutOrderId: item.cutOrderId
    }))
  }));
}
function toRuntimeSeedTickets(ticketRecords) {
  return ticketRecords.map((record) => ({
    feiTicketId: record.ticketRecordId,
    feiTicketNo: record.ticketNo,
    sourceSpreadingSessionId: record.sourceSpreadingSessionId || "",
    sourceSpreadingSessionNo: record.sourceSpreadingSessionNo || "",
    sourceMarkerId: record.sourceMarkerId || "",
    sourceMarkerNo: record.sourceMarkerNo || "",
    sourceWritebackId: "",
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderNo: record.productionOrderNo,
    markerPlanNo: record.sourceMarkerPlanNo,
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    fabricRollNo: record.fabricRollNo,
    fabricColor: record.fabricColor,
    color: record.color,
    size: record.size,
    partCode: record.partCode,
    partName: record.partName,
    bundleNo: record.bundleNo,
    qty: record.quantity,
    actualCutPieceQty: record.actualCutPieceQty,
    garmentQty: record.quantity,
    materialSku: record.materialSku,
    sourceContextType: record.sourceContextType,
    status: record.status
  }));
}
function sanitizeId(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function buildTaskResolutionResult(source, matches, missingReason, ambiguousReason) {
  if (matches.length === 1) {
    return {
      ok: true,
      reason: "",
      sewingTask: matches[0],
      source
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: ambiguousReason,
      sewingTask: null,
      source
    };
  }
  return {
    ok: false,
    reason: missingReason,
    sewingTask: null,
    source: null
  };
}
function resolveTransferBagCycleContextFromTicket(options) {
  if (!options.ticket) {
    return { ok: false, reason: "\u5F53\u524D\u7968\u53F7\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u786E\u8BA4\u83F2\u7968\u8BB0\u5F55\u3002", sewingTask: null, source: null };
  }
  if (options.ticket.markerPlanNo) {
    const matches = options.sewingTasks.filter((task) => task.sewingTaskId === `sewing-task-${sanitizeId(options.ticket.markerPlanNo)}`);
    const result = buildTaskResolutionResult(
      "marker-plan-ref",
      matches,
      "",
      `${options.ticket.markerPlanNo} \u5BF9\u5E94\u4E86\u591A\u4E2A\u8F66\u7F1D\u4EFB\u52A1\uFF0C\u6682\u4E0D\u80FD\u81EA\u52A8\u88C5\u888B\u3002`
    );
    if (result.ok || matches.length > 1) return result;
  }
  if (options.ticket.cutOrderId) {
    const matches = options.sewingTasks.filter(
      (task) => task.sewingTaskId === `sewing-task-fallback-${sanitizeId(options.ticket.cutOrderId)}`
    );
    const result = buildTaskResolutionResult(
      "cut-order",
      matches,
      "",
      `${options.ticket.cutOrderNo} \u5BF9\u5E94\u4E86\u591A\u4E2A\u8F66\u7F1D\u4EFB\u52A1\uFF0C\u6682\u4E0D\u80FD\u81EA\u52A8\u88C5\u888B\u3002`
    );
    if (result.ok || matches.length > 1) return result;
  }
  const styleMatches = options.sewingTasks.filter(
    (task) => task.styleCode === options.ticket.styleCode && task.spuCode === options.ticket.spuCode
  );
  if (styleMatches.length === 1) {
    return {
      ok: true,
      reason: "",
      sewingTask: styleMatches[0],
      source: "style-spu"
    };
  }
  if (styleMatches.length > 1) {
    return {
      ok: false,
      reason: `${options.ticket.ticketNo} \u65E0\u6CD5\u552F\u4E00\u5B9A\u4F4D\u8F66\u7F1D\u5382\uFF0C\u8BF7\u8054\u7CFB\u73ED\u7EC4\u957F\u786E\u8BA4\u3002`,
      sewingTask: null,
      source: "style-spu"
    };
  }
  return {
    ok: false,
    reason: `${options.ticket.ticketNo} \u65E0\u6CD5\u81EA\u52A8\u63A8\u5BFC\u5F53\u524D\u8F66\u7F1D\u5382 / \u4EFB\u52A1\uFF0C\u6682\u4E0D\u80FD\u88C5\u888B\u3002`,
    sewingTask: null,
    source: null
  };
}
function ensureUsageContextLockedByTicket(options) {
  if (options.usage?.sewingTaskId) {
    const lockedTask = options.sewingTasksById[options.usage.sewingTaskId] || null;
    if (!lockedTask) {
      return { ok: false, reason: "\u5F53\u524D\u5468\u8F6C\u4E0A\u4E0B\u6587\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u9996\u5F20\u83F2\u7968\u3002", sewingTask: null, source: null };
    }
    if (options.ticket) {
      const resolved = resolveTransferBagCycleContextFromTicket({
        ticket: options.ticket,
        sewingTasks: options.sewingTasks
      });
      if (resolved.ok && resolved.sewingTask && resolved.sewingTask.sewingTaskId !== lockedTask.sewingTaskId) {
        return {
          ok: false,
          reason: `\u5F53\u524D\u888B\u5DF2\u9501\u5B9A\u5230 ${lockedTask.sewingFactoryName} / ${lockedTask.styleCode || lockedTask.spuCode}\uFF0C\u8BF7\u786E\u8BA4\u540C\u5C5E\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u3002`,
          sewingTask: null,
          source: "usage-locked"
        };
      }
    }
    if (options.ticket && (lockedTask.styleCode && options.ticket.styleCode && lockedTask.styleCode !== options.ticket.styleCode || lockedTask.spuCode && options.ticket.spuCode && lockedTask.spuCode !== options.ticket.spuCode)) {
      return {
        ok: false,
        reason: `\u5F53\u524D\u888B\u5DF2\u9501\u5B9A\u5230 ${lockedTask.sewingFactoryName} / ${lockedTask.styleCode || lockedTask.spuCode}\uFF0C\u8BF7\u786E\u8BA4\u540C\u5C5E\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u3002`,
        sewingTask: null,
        source: "usage-locked"
      };
    }
    return {
      ok: true,
      reason: "",
      sewingTask: lockedTask,
      source: "usage-locked"
    };
  }
  return resolveTransferBagCycleContextFromTicket({
    ticket: options.ticket,
    sewingTasks: options.sewingTasks
  });
}
function formatNumber(value) {
  return numberFormatter.format(Math.max(value, 0));
}
function deriveTransferBagMasterStatus(status) {
  return createMeta(status, masterStatusMetaMap[status]);
}
function deriveTransferBagUsageStatus(status) {
  return createMeta(status, usageStatusMetaMap[status]);
}
function derivePocketCarrierStatus(status) {
  return createMeta(status, pocketCarrierStatusMetaMap[status]);
}
function deriveTransferBagVisibleStatusMeta(status) {
  return createMeta(status, visibleStatusMetaMap[status]);
}
function deriveTransferBagVisibleStatusFromUsage(options) {
  if (options.masterStatus === "DISABLED" || options.masterStatus === "WAITING_CLEANING" || options.masterStatus === "WAITING_REPAIR") {
    return "ARCHIVED";
  }
  if (!options.usage) return "IDLE";
  if (options.usage.usageStatus === "READY_TO_DISPATCH") return "READY_HANDOVER";
  if (options.usage.usageStatus === "DISPATCHED" || options.usage.usageStatus === "PENDING_SIGNOFF" || options.usage.usageStatus === "WAITING_RETURN" || options.usage.usageStatus === "RETURN_INSPECTING") {
    return "HANDED_OVER";
  }
  if (options.usage.usageStatus === "CLOSED") return "IDLE";
  if (options.usage.usageStatus === "EXCEPTION_CLOSED") return "ARCHIVED";
  return "IN_PROGRESS";
}
function deriveTransferBagVisibleStatusFromMaster(options) {
  return deriveTransferBagVisibleStatusFromUsage({
    usage: options.usage,
    masterStatus: options.master.currentStatus
  });
}
function isTransferBagUsageActiveStatus(status) {
  return status !== "CLOSED" && status !== "EXCEPTION_CLOSED";
}
function mapUsageStatusToPocketCarrierStatus(options) {
  if (options.masterStatus === "DISABLED") return "DISABLED";
  if (!options.usage) return "IDLE";
  if (options.usage.usageStatus === "READY_TO_DISPATCH") return "READY_TO_DISPATCH";
  if (options.usage.usageStatus === "DISPATCHED" || options.usage.usageStatus === "PENDING_SIGNOFF") return "DISPATCHED";
  if (options.usage.usageStatus === "WAITING_RETURN") return "SIGNED";
  if (options.usage.usageStatus === "RETURN_INSPECTING") return "RETURNED";
  if (options.usage.usageStatus === "CLOSED" || options.usage.usageStatus === "EXCEPTION_CLOSED") {
    return options.masterStatus === "DISABLED" ? "DISABLED" : "IDLE";
  }
  return "PACKING";
}
function buildWarehouseQueryPayload(options) {
  return {
    cutPieceWarehouse: {
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      markerPlanId: options.markerPlanId,
      markerPlanNo: options.markerPlanNo,
      materialSku: options.materialSku,
      spreadingSessionId: options.spreadingSessionId,
      sourceWritebackId: options.sourceWritebackId
    },
    feiTickets: {
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      ticketId: options.ticketId,
      ticketNo: options.ticketNo,
      materialSku: options.materialSku,
      markerPlanId: options.markerPlanId,
      markerPlanNo: options.markerPlanNo
    },
    cutOrders: {
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      markerPlanId: options.markerPlanId,
      markerPlanNo: options.markerPlanNo,
      materialSku: options.materialSku
    },
    summary: {
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      markerPlanId: options.markerPlanId,
      bagCode: options.bagCode,
      bagId: options.bagId,
      sewingTaskNo: options.sewingTaskNo,
      markerPlanNo: options.markerPlanNo,
      materialSku: options.materialSku,
      ticketId: options.ticketId,
      ticketNo: options.ticketNo,
      usageId: options.usageId,
      usageNo: options.usageNo
    }
  };
}
function buildTransferBagNavigationPayload(options) {
  return buildWarehouseQueryPayload(options);
}
function buildTransferBagParentChildSummary(bindings) {
  return {
    ticketCount: bindings.length,
    cutOrderCount: uniqueStrings(bindings.map((item) => item.cutOrderNo)).length,
    productionOrderCount: uniqueStrings(bindings.map((item) => item.productionOrderNo)).length,
    markerPlanRefCount: uniqueStrings(bindings.map((item) => item.markerPlanNo)).length,
    quantityTotal: bindings.reduce((sum, item) => sum + Math.max(item.qty, 0), 0),
    garmentQtyTotal: bindings.reduce((sum, item) => sum + Math.max(item.garmentQty ?? item.qty, 0), 0)
  };
}
function buildBagUsageAuditTrail(options) {
  return {
    auditTrailId: buildBagAuditId(options.actionAt, options.usageId, options.action),
    usageId: options.usageId,
    action: options.action,
    actionAt: options.actionAt,
    actionBy: options.actionBy,
    note: options.note
  };
}
function createTransferBagUsageDraft(options) {
  const runtimeUsage = createCarrierCycleRecord({
    carrier: toRuntimeCarrierRecord(options.bag),
    sewingTask: { ...options.sewingTask },
    nowText: options.nowText,
    existingUsages: options.existingUsages.map((item) => toRuntimeUsage(item)),
    note: options.note?.trim() || "\u6B63\u5F0F\u8F7D\u5177\u5468\u671F\u8349\u7A3F\u5DF2\u521B\u5EFA\uFF0C\u7B49\u5F85\u5148\u626B\u53E3\u888B\u7801\u518D\u626B\u83F2\u7968\u5B50\u7801\u3002"
  });
  return toPageUsage(runtimeUsage);
}
function validateBagToSewingTaskBinding(usage, sewingTaskId) {
  if (!usage) return { ok: false, reason: "\u5F53\u524D\u6CA1\u6709\u53EF\u7ED1\u5B9A\u7684\u4F7F\u7528\u5468\u671F\uFF0C\u8BF7\u5148\u521B\u5EFA\u4F7F\u7528\u5468\u671F\u8349\u7A3F\u3002" };
  if (isInboundTempTransferBagUsage(usage)) return { ok: true, reason: "" };
  if (!sewingTaskId) return { ok: false, reason: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5C1A\u672A\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1\u3002" };
  if (usage.sewingTaskId && usage.sewingTaskId !== sewingTaskId) {
    return { ok: false, reason: "\u540C\u4E00\u6B21\u4F7F\u7528\u5468\u671F\u53EA\u80FD\u5F52\u5C5E\u4E00\u4E2A\u8F66\u7F1D\u4EFB\u52A1\uFF0C\u8BF7\u786E\u8BA4\u540C\u5C5E\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u3002" };
  }
  return { ok: true, reason: "" };
}
function validateTicketBindingEligibility(options) {
  if (!options.ticket) return { ok: false, reason: "\u5F53\u524D\u7968\u53F7\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u786E\u8BA4\u83F2\u7968\u8BB0\u5F55\u3002" };
  if (!options.usage) return { ok: false, reason: "\u8BF7\u5148\u521B\u5EFA\u6216\u9009\u62E9\u4E00\u4E2A\u4F7F\u7528\u5468\u671F\uFF0C\u518D\u8FDB\u884C\u88C5\u888B\u3002" };
  const isInboundTempUsage = isInboundTempTransferBagUsage(options.usage);
  if (!options.sewingTask && !isInboundTempUsage) return { ok: false, reason: "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5C1A\u672A\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1\u3002" };
  if (options.ticket.ticketStatus === "VOIDED") {
    return { ok: false, reason: `${options.ticket.ticketNo} \u5DF2\u4F5C\u5E9F\uFF0C\u7981\u6B62\u7EE7\u7EED\u88C5\u888B\u3002` };
  }
  if (options.ticket.printStatus === "WAIT_PRINT" && options.ticket.ticketStatus !== "PRINTED") {
    return { ok: false, reason: `${options.ticket.ticketNo} \u672A\u9996\u6253\uFF0C\u4E0D\u80FD\u8FDB\u5165\u5165\u4ED3\u6682\u5B58\u888B\u3002` };
  }
  if (options.ticket.printStatus === "VOIDED") {
    return { ok: false, reason: `${options.ticket.ticketNo} \u5DF2\u4F5C\u5E9F\uFF0C\u7981\u6B62\u7EE7\u7EED\u88C5\u888B\u3002` };
  }
  if (!options.ticket.cutOrderId || !options.ticket.cutOrderNo) {
    return { ok: false, reason: "\u5F53\u524D\u83F2\u7968\u7F3A\u5C11\u88C1\u7247\u5355 owner\uFF0C\u4E0D\u80FD\u8FDB\u5165\u4E2D\u8F6C\u888B\u3002" };
  }
  const sameUsageBinding = options.bindings.find(
    (binding) => binding.ticketRecordId === options.ticket.ticketRecordId && binding.usageId === options.usage.usageId
  );
  if (sameUsageBinding) {
    return { ok: false, reason: `${options.ticket.ticketNo} \u5DF2\u5728\u5F53\u524D\u53E3\u888B\u4E2D\uFF0C\u65E0\u9700\u91CD\u590D\u88C5\u888B\u3002` };
  }
  const existingBinding = options.bindings.find((binding) => binding.ticketRecordId === options.ticket.ticketRecordId && binding.usageId !== options.usage.usageId);
  if (existingBinding) {
    const otherUsage = options.usagesById[existingBinding.usageId];
    if (otherUsage && isTransferBagUsageActiveStatus(otherUsage.usageStatus)) {
      return { ok: false, reason: `${options.ticket.ticketNo} \u5DF2\u7ED1\u5B9A\u5230 ${otherUsage.usageNo}\uFF0C\u4E0D\u80FD\u91CD\u590D\u88C5\u888B\u3002` };
    }
  }
  if (!isInboundTempUsage && options.sewingTask?.styleCode && options.ticket.styleCode && options.sewingTask.styleCode !== options.ticket.styleCode) {
    return { ok: false, reason: `${options.ticket.ticketNo} \u7684\u6B3E\u53F7\u4E0E\u5F53\u524D\u8F66\u7F1D\u4EFB\u52A1\u4E0D\u4E00\u81F4\uFF0C\u4E0D\u80FD\u88C5\u5165\u540C\u4E00\u4F7F\u7528\u5468\u671F\u3002` };
  }
  if (!isInboundTempUsage && options.sewingTask?.spuCode && options.ticket.spuCode && options.sewingTask.spuCode !== options.ticket.spuCode) {
    return { ok: false, reason: `${options.ticket.ticketNo} \u7684 SPU \u4E0E\u5F53\u524D\u8F66\u7F1D\u4EFB\u52A1\u4E0D\u4E00\u81F4\uFF0C\u4E0D\u80FD\u88C5\u5165\u540C\u4E00\u4F7F\u7528\u5468\u671F\u3002` };
  }
  return { ok: true, reason: "" };
}
function createTransferBagDispatchManifest(options) {
  const runtimeManifest = createCarrierDispatchManifest({
    cycle: toRuntimeUsage(options.usage),
    bindings: [],
    nowText: options.nowText,
    createdBy: options.createdBy,
    note: options.note?.trim() || "\u5F53\u524D\u4EA4\u63A5\u6E05\u5355\u6765\u81EA\u6B63\u5F0F\u8F7D\u5177\u5468\u671F\u6620\u5C04\u3002"
  });
  return {
    ...toPageManifest(runtimeManifest),
    ticketCount: options.summary.ticketCount,
    cutOrderCount: options.summary.cutOrderCount
  };
}
function buildSewingTaskSeeds(cutOrderRows = [], markerPlanRefs = []) {
  const markerPlanTaskSeeds = markerPlanRefs.slice(0, 3).map((batch, index) => {
    const factory = pickTransferBagSewingFactory(index);
    return {
      sewingTaskId: `sewing-task-${sanitizeId(batch.markerPlanNo)}`,
      sewingTaskNo: `CF-${String(index + 1).padStart(3, "0")}`,
      sewingFactoryId: factory.factoryId,
      sewingFactoryName: factory.factoryName,
      styleCode: batch.styleCode,
      spuCode: batch.spuCode,
      skuSummary: batch.materialSkuSummary,
      colorSummary: uniqueStrings(batch.items.map((item) => cutOrderRows.find((row) => row.cutOrderId === item.cutOrderId)?.color)).join(" / ") || "\u6DF7\u8272",
      sizeSummary: "S / M / L",
      plannedQty: batch.items.length * 24,
      status: index === 0 ? "\u5F85\u63A5\u6599" : index === 1 ? "\u6392\u5355\u4E2D" : "\u5F85\u4EA4\u63A5",
      note: `\u6765\u6E90\u4E8E ${batch.markerPlanNo} \u7684\u540E\u9053\u4EA4\u63A5\u4EFB\u52A1\u9884\u7559\u3002`
    };
  });
  const fallbackRows = cutOrderRows.map((row, index) => {
    const factory = pickTransferBagSewingFactory(index + markerPlanTaskSeeds.length);
    return {
      sewingTaskId: `sewing-task-fallback-${sanitizeId(row.cutOrderId)}`,
      sewingTaskNo: `CF-FB-${String(index + 1).padStart(3, "0")}`,
      sewingFactoryId: factory.factoryId,
      sewingFactoryName: factory.factoryName,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      skuSummary: row.materialSku,
      colorSummary: row.color,
      sizeSummary: "\u9ED8\u8BA4\u5C3A\u7801\u7EC4",
      plannedQty: row.plannedQty || row.orderQty,
      status: "\u5F85\u63A5\u6599",
      note: "\u7528\u4E8E\u65E0\u6279\u6B21\u573A\u666F\u4E0B\u7684\u4EA4\u63A5\u4EFB\u52A1\u9884\u7559\u3002"
    };
  });
  return [...markerPlanTaskSeeds, ...fallbackRows];
}
function buildTicketCandidates(ticketRecords) {
  return ticketRecords.map((record) => ({
    ticketRecordId: record.ticketRecordId,
    feiTicketId: record.ticketRecordId,
    ticketNo: record.ticketNo,
    printStatus: record.printStatus,
    sourceSpreadingSessionId: record.sourceSpreadingSessionId || "",
    sourceSpreadingSessionNo: record.sourceSpreadingSessionNo || "",
    sourceMarkerId: record.sourceMarkerId || "",
    sourceMarkerNo: record.sourceMarkerNo || "",
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderId: record.sourceProductionOrderId || "",
    productionOrderNo: record.productionOrderNo,
    markerPlanId: record.sourceMarkerPlanId || "",
    markerPlanNo: record.sourceMarkerPlanNo,
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    fabricRollNo: record.fabricRollNo || "",
    fabricColor: record.fabricColor || record.color || "",
    color: record.color,
    size: record.size || "",
    partCode: record.partCode || "",
    partName: record.partName || "",
    bundleNo: record.bundleNo || "",
    qty: Math.max(record.quantity ?? 1, 1),
    actualCutPieceQty: Math.max(record.actualCutPieceQty ?? record.quantity ?? 1, 1),
    garmentQty: Math.max(record.quantity ?? 1, 1),
    materialSku: record.materialSku,
    materialAlias: record.materialAlias || "",
    materialImageUrl: record.materialImageUrl || "",
    pieceSequenceLabel: record.pieceSequenceLabel || record.pieceSetNoRange || "",
    hasSpecialCraft: Boolean(record.hasSpecialCraft),
    specialCraftDisplayLabel: record.specialCraftDisplayLabel || (record.hasSpecialCraft ? "\u7279\u6B8A\u5DE5\u827A\u5F85\u7EF4\u62A4" : "\u65E0"),
    receiverFactoryDisplay: record.specialCrafts?.length ? uniqueStrings(record.specialCrafts.map((craft) => craft.receiverFactoryName || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145")).join("\u3001") : "\u65E0",
    sourceContextType: record.sourceContextType,
    ticketStatus: record.status
  })).sort((left, right) => left.ticketNo.localeCompare(right.ticketNo, "zh-CN"));
}
function buildActiveTicketPocketBindingMap(store) {
  const usagesById = Object.fromEntries(store.usages.map((item) => [item.usageId, item]));
  return store.bindings.reduce((accumulator, binding) => {
    const usage = usagesById[binding.usageId];
    if (!usage || !isTransferBagUsageActiveStatus(usage.usageStatus)) return accumulator;
    accumulator[binding.ticketRecordId] = {
      bindingId: binding.bindingId,
      ticketRecordId: binding.ticketRecordId,
      ticketNo: binding.ticketNo,
      pocketId: binding.bagId,
      pocketNo: binding.bagCode,
      usageId: usage.usageId,
      usageNo: binding.usageNo || usage.usageNo,
      styleCode: usage.styleCode,
      boundAt: binding.boundAt,
      usageStatus: usage.usageStatus
    };
    return accumulator;
  }, {});
}
function applyPocketBindingLocksToTicketRecords(ticketRecords, store) {
  const activeBindings = buildActiveTicketPocketBindingMap(store);
  return ticketRecords.map((record) => {
    const binding = activeBindings[record.ticketRecordId];
    if (!binding) {
      return {
        ...record,
        downstreamLocked: false,
        downstreamLockedReason: "",
        boundPocketNo: "",
        boundUsageNo: ""
      };
    }
    return {
      ...record,
      downstreamLocked: true,
      downstreamLockedReason: `${binding.pocketNo} / ${binding.usageNo} \u4F7F\u7528\u5468\u671F\u672A\u5173\u95ED\uFF0C\u5F53\u524D\u7981\u6B62\u4F5C\u5E9F\u6216\u91CD\u590D\u88C5\u888B\u3002`,
      boundPocketNo: binding.pocketNo,
      boundUsageNo: binding.usageNo
    };
  });
}
function buildSystemSeedTransferBagStore(options) {
  const markerPlanRefs = options.markerPlanRefs ?? [];
  return toPageStore(
    buildSystemSeedTransferBagRuntime({
      cutOrderRows: toRuntimeSeedCutOrderRows(options.cutOrderRows),
      ticketRecords: toRuntimeSeedTickets(options.ticketRecords),
      markerPlanRefs: toRuntimeSeedMarkerPlanRefs(markerPlanRefs)
    })
  );
}
function serializeTransferBagStorage(store) {
  return serializeTransferBagRuntimeStorage(toRuntimeStore(store));
}
function deserializeTransferBagStorage(raw) {
  return toPageStore(deserializeTransferBagRuntimeStorage(raw));
}
function deserializeTransferBagSelectedTicketIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
function serializeTransferBagSelectedTicketIds(ids) {
  return JSON["stringify"](ids);
}
function mergeTransferBagStores(seed, stored) {
  return toPageStore(
    mergeTransferBagRuntimeStores(toRuntimeStore(seed), toRuntimeStore(stored))
  );
}
function buildTransferBagStageLedgerItems(usageItems) {
  const dispatchOrders = listCuttingSewingDispatchOrders();
  const dispatchBatches = listCuttingSewingDispatchBatches();
  const handoverBags = listCuttingSewingTransferBags();
  const ordersById = Object.fromEntries(dispatchOrders.map((item) => [item.dispatchOrderId, item]));
  const batchesById = Object.fromEntries(dispatchBatches.map((item) => [item.dispatchBatchId, item]));
  const inboundRows = usageItems.filter((usage) => usage.usageStage === "INBOUND_TEMP").map((usage) => ({
    stage: "INBOUND_TEMP",
    stageLabel: "\u5165\u4ED3\u6682\u5B58",
    sourceKind: "INBOUND_USAGE",
    carrierCode: usage.bagCode,
    cycleNo: usage.usageNo,
    productionOrderNos: usage.productionOrderNos,
    cutOrderNos: usage.cutOrderNos,
    ticketCount: usage.summary.ticketCount,
    statusLabel: usage.visibleStatusMeta.label,
    relationLabel: "\u672A\u7ED1\u5B9A\u4EA4\u51FA\u5355\uFF0C\u5F85\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u540E\u4E8C\u6B21\u5206\u62E3",
    relationOk: true,
    handoverOrderNo: "",
    handoverRecordNo: "",
    dispatchBatchNo: "",
    ruleLabel: getTransferBagRuleLabel("INBOUND_TEMP")
  }));
  const handoverRows = handoverBags.map((bag) => {
    const order = ordersById[bag.dispatchOrderId] || null;
    const batch = batchesById[bag.dispatchBatchId] || null;
    const handoverOrderNo = order?.handoverOrderNo || order?.dispatchOrderNo || "";
    const handoverRecordNo = batch?.handoverRecordNo || "";
    const relationOk = Boolean(handoverOrderNo || handoverRecordNo);
    const relationLabel = handoverRecordNo ? `\u4EA4\u51FA\u5355 ${handoverOrderNo || "\u5F85\u8865"} / \u4EA4\u51FA\u8BB0\u5F55 ${handoverRecordNo}` : `\u4EA4\u51FA\u5355 ${handoverOrderNo || "\u5F85\u8865"} / \u4EA4\u51FA\u8BB0\u5F55\u5F85\u65B0\u589E`;
    return {
      stage: "HANDOVER_PACKING",
      stageLabel: "\u4EA4\u51FA\u88C5\u888B",
      sourceKind: "HANDOVER_BAG",
      carrierCode: bag.transferBagNo,
      cycleNo: bag.transferOrderNo,
      productionOrderNos: [bag.productionOrderNo],
      cutOrderNos: bag.cuttingOrderNos,
      ticketCount: bag.scannedFeiTicketNos.length || bag.contentFeiTicketCount || bag.expectedFeiTicketCount || 0,
      statusLabel: bag.status,
      relationLabel,
      relationOk,
      handoverOrderNo,
      handoverRecordNo,
      dispatchBatchNo: batch?.dispatchBatchNo || bag.dispatchBatchId,
      ruleLabel: getTransferBagRuleLabel("HANDOVER_PACKING")
    };
  });
  return [...inboundRows, ...handoverRows];
}
function deriveCutPieceSortingTaskStatus(batchStatus, targetBags, pickedTicketCount) {
  if (batchStatus === "\u5DEE\u5F02" || batchStatus === "\u5F02\u8BAE\u4E2D" || targetBags.some((bag) => bag.status === "\u5DEE\u5F02" || bag.status === "\u5F02\u8BAE\u4E2D")) return "\u5DEE\u5F02";
  if (batchStatus === "\u5DF2\u56DE\u5199" || targetBags.some((bag) => bag.status === "\u5DF2\u56DE\u5199")) return "\u5DF2\u56DE\u5199";
  if (batchStatus === "\u5DF2\u4EA4\u51FA" || targetBags.some((bag) => bag.status === "\u5DF2\u4EA4\u51FA" || bag.handoverSubmittedAt)) return "\u5DF2\u4EA4\u51FA";
  if (batchStatus === "\u5DF2\u6838\u5BF9" || targetBags.some((bag) => bag.status === "\u5DF2\u6838\u5BF9")) return "\u5DF2\u88C5\u888B";
  if (pickedTicketCount > 0 || targetBags.some((bag) => bag.status === "\u88C5\u888B\u4E2D")) return "\u5206\u62E3\u4E2D";
  return "\u5F85\u5206\u62E3";
}
function buildCutPieceSortingTasks(usageItems) {
  const dispatchOrders = listCuttingSewingDispatchOrders();
  const dispatchBatches = listCuttingSewingDispatchBatches();
  const handoverBags = listCuttingSewingTransferBags();
  const ordersById = Object.fromEntries(dispatchOrders.map((item) => [item.dispatchOrderId, item]));
  const inboundTempUsages = usageItems.filter((usage) => usage.usageStage === "INBOUND_TEMP");
  return dispatchBatches.map((batch) => {
    const order = ordersById[batch.dispatchOrderId] || null;
    const sourceTempUsages = inboundTempUsages.filter((usage) => usage.productionOrderNos.includes(batch.productionOrderNo));
    const targetBags = handoverBags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId));
    const pickedTicketCount = targetBags.reduce((total, bag) => total + (bag.scannedFeiTicketNos.length || bag.contentFeiTicketCount || 0), 0);
    const expectedTicketCount = targetBags.reduce(
      (total, bag) => total + (bag.expectedFeiTicketCount || bag.pieceLines.length || bag.skuQtyLines.length || 0),
      0
    );
    return {
      sortingTaskId: `CPST-${batch.dispatchBatchId}`,
      sortingTaskNo: `CPT-${batch.dispatchBatchNo}`,
      dispatchOrderNo: order?.dispatchOrderNo || batch.transferOrderNo,
      dispatchBatchId: batch.dispatchBatchId,
      dispatchBatchNo: batch.dispatchBatchNo,
      productionOrderNo: batch.productionOrderNo,
      targetFactoryName: order?.sewingFactoryName || "\u63A5\u6536\u5BF9\u8C61\u5F85\u8865",
      skuSummary: batch.plannedSkuQtyLines.map((line) => `${line.colorName}/${line.sizeCode}`).join("\u3001"),
      plannedGarmentQty: batch.plannedGarmentQty,
      sourceTempBagNos: uniqueStrings(sourceTempUsages.map((usage) => usage.bagCode)),
      sourceTempUsageNos: uniqueStrings(sourceTempUsages.map((usage) => usage.usageNo)),
      sourceTempTicketCount: sourceTempUsages.reduce((total, usage) => total + usage.summary.ticketCount, 0),
      targetTransferBagNos: uniqueStrings(targetBags.map((bag) => bag.transferBagNo)),
      expectedTicketCount,
      pickedTicketCount,
      status: deriveCutPieceSortingTaskStatus(batch.status, targetBags, pickedTicketCount)
    };
  }).sort((left, right) => right.sortingTaskNo.localeCompare(left.sortingTaskNo, "zh-CN"));
}
function buildInboundTempBagMixedSummary(tickets) {
  const productionOrderCount = uniqueStrings(tickets.map((ticket) => ticket.productionOrderNo)).length;
  const cutOrderCount = uniqueStrings(tickets.map((ticket) => ticket.cutOrderNo)).length;
  const partCount = uniqueStrings(tickets.map((ticket) => ticket.partName)).length;
  const sizeCount = uniqueStrings(tickets.map((ticket) => ticket.size)).length;
  return `\u6D89\u53CA ${productionOrderCount} \u4E2A\u751F\u4EA7\u5355 / ${cutOrderCount} \u5F20\u88C1\u7247\u5355 / ${partCount} \u4E2A\u90E8\u4F4D / ${sizeCount} \u4E2A\u5C3A\u7801`;
}
function buildInboundTempBagDiscrepancies(usage, tickets, inboundBy) {
  if (usage.bagCode !== "BAG-B-003") return [];
  const anchorTicket = tickets[0];
  return [
    {
      discrepancyId: `DISC-${usage.usageId}-QTY`,
      discrepancyType: "\u5B9E\u7269\u6570\u91CF\u548C\u83F2\u7968\u6570\u91CF\u4E0D\u4E00\u81F4",
      feiTicketId: anchorTicket?.feiTicketId || "",
      bagCode: usage.bagCode,
      expectedQty: usage.summary.quantityTotal,
      actualQty: Math.max(usage.summary.quantityTotal - 2, 0),
      unit: "\u7247",
      evidencePhotos: ["photo://inbound-temp-bag/BAG-B-003/qty-check"],
      remark: "\u73B0\u573A\u590D\u6838\u53D1\u73B0\u4E00\u624E\u83F2\u7968\u8FB9\u89D2\u7834\u635F\uFF0C\u5DF2\u62CD\u7167\u5907\u6CE8\uFF0C\u7B49\u5F85\u4ED3\u7BA1\u6838\u5BF9\u3002",
      reportedAt: usage.startedAt || usage.finishedPackingAt || "",
      reportedBy: inboundBy,
      handlingStatus: "\u5F85\u5904\u7406"
    }
  ];
}
function buildInboundTempBagsFromTransferBagViewModel(viewModel) {
  return viewModel.usages.filter((usage) => usage.usageStage === "INBOUND_TEMP").map((usage) => {
    const audits = viewModel.auditTrailByUsageId[usage.usageId] || [];
    const firstAudit = audits[0];
    const inboundBy = firstAudit?.actionBy || "\u88C1\u7247\u4ED3\u5165\u4ED3\u5458";
    const inboundAt = usage.startedAt || firstAudit?.actionAt || usage.finishedPackingAt || "";
    const containedFeiTickets = usage.bindingItems.map((binding) => {
      const ticket = binding.ticket;
      return {
        feiTicketId: ticket?.feiTicketId || binding.feiTicketId,
        feiTicketNo: ticket?.ticketNo || binding.ticketNo,
        productionOrderId: ticket?.productionOrderId || "",
        productionOrderNo: ticket?.productionOrderNo || binding.productionOrderNo,
        cutOrderId: ticket?.cutOrderId || binding.cutOrderId,
        cutOrderNo: ticket?.cutOrderNo || binding.cutOrderNo,
        spreadingOrderNo: ticket?.sourceSpreadingSessionNo || binding.sourceSpreadingSessionNo || "",
        spuCode: ticket?.spuCode || "",
        color: ticket?.color || "",
        size: ticket?.size || "",
        partName: ticket?.partName || "",
        pieceQty: ticket?.actualCutPieceQty || binding.quantity || 0,
        pieceSequenceLabel: ticket?.pieceSequenceLabel || "\u6309\u83F2\u7968\u8FFD\u8E2A",
        hasSpecialCraft: Boolean(ticket?.hasSpecialCraft),
        specialCraftDisplay: ticket?.hasSpecialCraft ? ticket.specialCraftDisplayLabel || "\u7279\u6B8A\u5DE5\u827A\u5F85\u7EF4\u62A4" : "\u65E0",
        receiverFactoryDisplay: ticket?.hasSpecialCraft ? ticket.receiverFactoryDisplay || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145" : "\u65E0",
        printStatus: getTransferBagTicketPrintStatusLabel(ticket),
        voidStatus: ticket?.ticketStatus === "VOIDED" || ticket?.printStatus === "VOIDED" ? "\u5DF2\u4F5C\u5E9F" : "\u6709\u6548"
      };
    });
    if (usage.bagCode === "BAG-B-003" && !containedFeiTickets.some((ticket) => ticket.feiTicketNo === "FT-CUT-260307-102-02-DEMO-FRONT")) {
      containedFeiTickets.push(
        {
          feiTicketId: "demo-khaki-front-ready-inventory",
          feiTicketNo: "FT-CUT-260307-102-02-DEMO-FRONT",
          productionOrderId: "PO-202603-0102",
          productionOrderNo: "PO-202603-0102",
          cutOrderId: "cut-order:po-202603-0102:tdv-demand-spu-2024-010-bom-khaki-canvas:tdv-demand-spu-2024-010-pattern-main:v1-0:145cm",
          cutOrderNo: "CUT-260307-102-02",
          spreadingOrderNo: "PB-030101-02",
          spuCode: "SPU-2024-010",
          color: "Khaki",
          size: "L",
          partName: "\u524D\u7247",
          pieceQty: 128,
          pieceSequenceLabel: "1-128",
          hasSpecialCraft: false,
          specialCraftDisplay: "\u65E0",
          receiverFactoryDisplay: "\u65E0",
          printStatus: "\u5DF2\u9996\u6253",
          voidStatus: "\u6709\u6548"
        },
        {
          feiTicketId: "demo-khaki-back-ready-inventory",
          feiTicketNo: "FT-CUT-260307-102-02-DEMO-BACK",
          productionOrderId: "PO-202603-0102",
          productionOrderNo: "PO-202603-0102",
          cutOrderId: "cut-order:po-202603-0102:tdv-demand-spu-2024-010-bom-khaki-canvas:tdv-demand-spu-2024-010-pattern-main:v1-0:145cm",
          cutOrderNo: "CUT-260307-102-02",
          spreadingOrderNo: "PB-030101-02",
          spuCode: "SPU-2024-010",
          color: "Khaki",
          size: "L",
          partName: "\u540E\u7247",
          pieceQty: 128,
          pieceSequenceLabel: "1-128",
          hasSpecialCraft: false,
          specialCraftDisplay: "\u65E0",
          receiverFactoryDisplay: "\u65E0",
          printStatus: "\u5DF2\u9996\u6253",
          voidStatus: "\u6709\u6548"
        }
      );
    }
    const productionOrderCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length;
    const cutOrderCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length;
    const partCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.partName)).length;
    const sizeCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.size)).length;
    const specialCraftLabels = uniqueStrings(containedFeiTickets.map((ticket) => ticket.hasSpecialCraft ? "\u6709\u7279\u6B8A\u5DE5\u827A" : "\u65E0\u7279\u6B8A\u5DE5\u827A"));
    const mixedFlag = productionOrderCount > 1 || cutOrderCount > 1 || partCount > 1 || sizeCount > 1 || specialCraftLabels.length > 1;
    const warehouseArea = usage.bagMaster?.currentLocation || "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5165\u4ED3\u6682\u5B58\u4F4D";
    const discrepancyRecords = buildInboundTempBagDiscrepancies(usage, containedFeiTickets, inboundBy);
    return {
      tempBagUseId: usage.usageId,
      bagCode: usage.bagCode,
      bagMasterId: usage.bagId,
      useStage: "\u5165\u4ED3\u6682\u5B58",
      warehouseId: "cutting-wait-handover",
      warehouseName: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
      warehouseArea,
      locationCode: warehouseArea,
      inboundStatus: usage.statusMeta.label,
      inboundAt,
      inboundBy,
      inboundSource: "PDA \u5165\u4ED3\u626B\u7801",
      containedFeiTickets,
      totalPieceQty: containedFeiTickets.reduce((total, ticket) => total + ticket.pieceQty, 0),
      mixedFlag,
      mixedSummary: buildInboundTempBagMixedSummary(containedFeiTickets),
      discrepancyRecords,
      nextSortingStatus: usage.sewingTaskNo ? "\u5DF2\u53C2\u4E0E\u540E\u7EED\u5206\u62E3" : "\u672A\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1\uFF0C\u5F85\u540E\u7EED\u5206\u914D\u540E\u518D\u4E8C\u6B21\u5206\u62E3",
      remark: usage.note || INBOUND_TEMP_BAG_RULE_LABEL
    };
  }).sort((left, right) => right.inboundAt.localeCompare(left.inboundAt, "zh-CN"));
}
function buildInboundTempBagInventoryRecords(bags) {
  return bags.flatMap(
    (bag) => bag.containedFeiTickets.map((ticket) => ({
      inventoryRecordId: `INV-${bag.tempBagUseId}-${ticket.feiTicketId}`,
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      productionOrderId: ticket.productionOrderId,
      productionOrderNo: ticket.productionOrderNo,
      spuCode: ticket.spuCode,
      color: ticket.color,
      size: ticket.size,
      partName: ticket.partName,
      pieceQty: ticket.pieceQty,
      pieceSequenceLabel: ticket.pieceSequenceLabel,
      hasSpecialCraft: ticket.hasSpecialCraft,
      specialCraftDisplay: ticket.specialCraftDisplay,
      receiverFactoryDisplay: ticket.receiverFactoryDisplay,
      printStatus: ticket.printStatus,
      voidStatus: ticket.voidStatus,
      tempBagCode: bag.bagCode,
      warehouseArea: bag.warehouseArea,
      locationCode: bag.locationCode,
      inboundAt: bag.inboundAt,
      inventoryStatus: "\u5F85\u5206\u914D"
    }))
  );
}
function buildTransferBagViewModel(options) {
  void options.markerPlanRefs;
  const spreadingTraceAnchors = options.spreadingStore ? buildSpreadingTraceAnchors(options.spreadingStore) : [];
  const ticketCandidates = buildTicketCandidates(options.ticketRecords);
  const ticketCandidatesById = Object.fromEntries(ticketCandidates.map((item) => [item.ticketRecordId, item]));
  const ticketCandidatesByNo = Object.fromEntries(ticketCandidates.map((item) => [item.ticketNo, item]));
  const activeTicketBindingsByTicketId = buildActiveTicketPocketBindingMap(options.store);
  const sewingTasksById = Object.fromEntries(options.store.sewingTasks.map((item) => [item.sewingTaskId, item]));
  const usagesByIdRaw = Object.fromEntries(options.store.usages.map((item) => [item.usageId, item]));
  const bindingsByUsageIdRaw = {};
  const manifestsByUsageId = {};
  const auditTrailByUsageId = {};
  options.store.bindings.forEach((binding) => {
    if (!bindingsByUsageIdRaw[binding.usageId]) bindingsByUsageIdRaw[binding.usageId] = [];
    bindingsByUsageIdRaw[binding.usageId].push(binding);
  });
  options.store.manifests.forEach((manifest) => {
    if (!manifestsByUsageId[manifest.usageId]) manifestsByUsageId[manifest.usageId] = [];
    manifestsByUsageId[manifest.usageId].push(manifest);
  });
  options.store.auditTrail.forEach((audit) => {
    if (!auditTrailByUsageId[audit.usageId]) auditTrailByUsageId[audit.usageId] = [];
    auditTrailByUsageId[audit.usageId].push(audit);
  });
  function resolveBindingTraceAnchor(binding, usageItem) {
    if (usageItem?.spreadingSessionId) {
      const inheritedAnchor = spreadingTraceAnchors.find((item) => item.spreadingSessionId === usageItem.spreadingSessionId) || null;
      if (inheritedAnchor) return inheritedAnchor;
    }
    const ticket = ticketCandidatesById[binding.ticketRecordId];
    if (ticket?.sourceSpreadingSessionId) {
      const exactAnchor = spreadingTraceAnchors.find((item) => item.spreadingSessionId === ticket.sourceSpreadingSessionId) || null;
      if (exactAnchor) return exactAnchor;
    }
    return findSpreadingTraceAnchor(spreadingTraceAnchors, {
      cutOrderIds: binding.cutOrderId ? [binding.cutOrderId] : [],
      markerPlanId: ticket?.markerPlanId || "",
      materialSku: ticket?.materialSku || "",
      color: ticket?.color || ""
    });
  }
  function resolveUsageTraceAnchor(usage, bindings) {
    const explicitSessionIds = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.sourceSpreadingSessionId).filter(Boolean)
    );
    if (explicitSessionIds.length === 1) {
      const exactAnchor = spreadingTraceAnchors.find((item) => item.spreadingSessionId === explicitSessionIds[0]) || null;
      if (exactAnchor) return exactAnchor;
    }
    const cutOrderIds = uniqueStrings(bindings.map((item) => item.cutOrderId));
    const markerPlanIds = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.markerPlanId).filter(Boolean)
    );
    const materialSkus = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.materialSku).filter(Boolean)
    );
    const colors = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.color).filter(Boolean)
    );
    return findSpreadingTraceAnchor(spreadingTraceAnchors, {
      cutOrderIds,
      markerPlanId: markerPlanIds[0] || "",
      materialSku: materialSkus[0] || usage.skuSummary || "",
      color: colors[0] || usage.colorSummary || ""
    });
  }
  const usageItems = options.store.usages.map((usage) => {
    const bindings = (bindingsByUsageIdRaw[usage.usageId] || []).slice().sort((left, right) => left.boundAt.localeCompare(right.boundAt, "zh-CN"));
    const traceAnchor = resolveUsageTraceAnchor(usage, bindings);
    const summary = buildTransferBagParentChildSummary(bindings);
    const manifests = (manifestsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt, "zh-CN"));
    const bagMaster = options.store.masters.find((item) => item.bagId === usage.bagId) ?? null;
    const sewingTask = sewingTasksById[usage.sewingTaskId] ?? null;
    const usageStage = normalizeTransferBagUsageStage(usage.usageStage);
    const sewingFactoryName = usageStage === "INBOUND_TEMP" ? "\u5F85\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D" : resolveTransferBagFactoryName(
      usage.sewingFactoryId || sewingTask?.sewingFactoryId,
      usage.sewingFactoryName || sewingTask?.sewingFactoryName
    );
    const pocketStatusKey = mapUsageStatusToPocketCarrierStatus({
      usage,
      masterStatus: bagMaster?.currentStatus || "IDLE"
    });
    return {
      ...usage,
      usageStage,
      usageStageLabel: usage.usageStageLabel || getTransferBagUsageStageLabel(usageStage),
      sewingFactoryName,
      statusMeta: deriveTransferBagUsageStatus(usage.usageStatus),
      visibleStatusKey: deriveTransferBagVisibleStatusFromUsage({
        usage,
        masterStatus: bagMaster?.currentStatus || "IDLE"
      }),
      visibleStatusMeta: deriveTransferBagVisibleStatusMeta(
        deriveTransferBagVisibleStatusFromUsage({
          usage,
          masterStatus: bagMaster?.currentStatus || "IDLE"
        })
      ),
      pocketStatusKey,
      pocketStatusMeta: derivePocketCarrierStatus(pocketStatusKey),
      bagMaster,
      sewingTask: sewingTask ? {
        ...sewingTask,
        sewingFactoryName: resolveTransferBagFactoryName(sewingTask.sewingFactoryId, sewingTask.sewingFactoryName)
      } : null,
      summary,
      bindingItems: [],
      boundTicketIds: bindings.map((item) => item.ticketRecordId),
      ticketNos: bindings.map((item) => item.ticketNo),
      cutOrderNos: uniqueStrings(bindings.map((item) => item.cutOrderNo)),
      productionOrderNos: uniqueStrings(bindings.map((item) => item.productionOrderNo)),
      sourceMarkerNos: uniqueStrings(bindings.map((item) => item.sourceMarkerNo)),
      markerPlanNos: uniqueStrings(bindings.map((item) => item.markerPlanNo)),
      latestManifest: manifests[0] ?? null,
      spreadingSessionId: traceAnchor?.spreadingSessionId || "",
      spreadingSessionNo: traceAnchor?.spreadingSessionNo || "",
      spreadingSourceWritebackId: traceAnchor?.sourceWritebackId || "",
      spreadingUpdatedFromPdaAt: traceAnchor?.updatedFromPdaAt || "",
      spreadingColorSummary: traceAnchor?.colorSummary || "",
      bagFirstSatisfied: bindings.length > 0,
      bagFirstRuleLabel: getTransferBagRuleLabel(usageStage),
      navigationPayload: buildTransferBagNavigationPayload({
        cutOrderId: bindings[0]?.cutOrderId,
        cutOrderNo: bindings[0]?.cutOrderNo,
        productionOrderId: bindings[0]?.ticket?.productionOrderId || "",
        productionOrderNo: bindings[0]?.productionOrderNo,
        markerPlanId: bindings[0]?.ticket?.markerPlanId || "",
        markerPlanNo: bindings[0]?.markerPlanNo || void 0,
        materialSku: bindings[0]?.ticket?.materialSku || "",
        spreadingSessionId: traceAnchor?.spreadingSessionId || void 0,
        sourceWritebackId: traceAnchor?.sourceWritebackId || void 0,
        bagId: usage.bagId,
        bagCode: usage.bagCode,
        usageId: usage.usageId,
        usageNo: usage.usageNo,
        sewingTaskNo: usage.sewingTaskNo
      })
    };
  }).sort((left, right) => right.usageNo.localeCompare(left.usageNo, "zh-CN"));
  const usageItemsById = Object.fromEntries(usageItems.map((item) => [item.usageId, item]));
  const masterItems = options.store.masters.map((master) => {
    const relatedUsages = usageItems.filter((item) => item.bagId === master.bagId).sort((left, right) => right.usageNo.localeCompare(left.usageNo, "zh-CN"));
    const usage = relatedUsages.find((item) => isTransferBagUsageActiveStatus(item.usageStatus)) ?? null;
    const latestUsage = relatedUsages[0] ?? null;
    const bindings = usage ? bindingsByUsageIdRaw[usage.usageId] || [] : [];
    const summary = buildTransferBagParentChildSummary(bindings);
    const pocketStatusKey = mapUsageStatusToPocketCarrierStatus({
      usage,
      masterStatus: master.currentStatus
    });
    return {
      ...master,
      statusMeta: deriveTransferBagMasterStatus(master.currentStatus),
      visibleStatusKey: deriveTransferBagVisibleStatusFromMaster({
        master,
        usage
      }),
      visibleStatusMeta: deriveTransferBagVisibleStatusMeta(
        deriveTransferBagVisibleStatusFromMaster({
          master,
          usage
        })
      ),
      latestUsageStatusMeta: latestUsage ? latestUsage.statusMeta : null,
      packedTicketCount: summary.ticketCount,
      packedCutOrderCount: summary.cutOrderCount,
      pocketStatusKey,
      pocketStatusMeta: derivePocketCarrierStatus(pocketStatusKey),
      currentUsage: usage,
      currentStyleCode: usage?.styleCode || "",
      currentTotalPieceCount: summary.quantityTotal,
      currentGarmentQtyTotal: summary.garmentQtyTotal,
      currentSourceProductionOrderCount: summary.productionOrderCount,
      currentSourceCutOrderCount: summary.cutOrderCount,
      currentSourceMarkerPlanCount: summary.markerPlanRefCount,
      currentDispatchedAt: usage?.dispatchAt || latestUsage?.dispatchAt || "",
      currentSignedAt: usage?.signedAt || latestUsage?.signedAt || "",
      currentReturnedAt: usage?.returnedAt || latestUsage?.returnedAt || ""
    };
  }).sort((left, right) => left.bagCode.localeCompare(right.bagCode, "zh-CN"));
  const bindingItems = options.store.bindings.map((binding) => {
    const usageItem = usageItemsById[binding.usageId] ?? null;
    const traceAnchor = resolveBindingTraceAnchor(binding, usageItem);
    const ticketCandidate = ticketCandidatesById[binding.ticketRecordId] ?? null;
    return {
      ...binding,
      usage: usageItem,
      ticket: ticketCandidate,
      fabricRollNo: binding.fabricRollNo || ticketCandidate?.fabricRollNo || "",
      fabricColor: binding.fabricColor || ticketCandidate?.fabricColor || "",
      size: binding.size || ticketCandidate?.size || "",
      partName: binding.partName || ticketCandidate?.partName || "",
      bundleNo: binding.bundleNo || ticketCandidate?.bundleNo || "",
      pocketStatusKey: mapUsageStatusToPocketCarrierStatus({
        usage: usagesByIdRaw[binding.usageId] ?? null,
        masterStatus: options.store.masters.find((item) => item.bagId === binding.bagId)?.currentStatus || "IDLE"
      }),
      removable: ["DRAFT", "PACKING"].includes(usagesByIdRaw[binding.usageId]?.usageStatus || ""),
      spreadingSessionId: traceAnchor?.spreadingSessionId || "",
      spreadingSessionNo: traceAnchor?.spreadingSessionNo || "",
      spreadingSourceWritebackId: traceAnchor?.sourceWritebackId || "",
      bagFirstRuleLabel: getTransferBagRuleLabel(usageItem?.usageStage),
      navigationPayload: buildTransferBagNavigationPayload({
        cutOrderId: binding.cutOrderId,
        cutOrderNo: binding.cutOrderNo,
        productionOrderId: ticketCandidatesById[binding.ticketRecordId]?.productionOrderId || "",
        productionOrderNo: binding.productionOrderNo,
        markerPlanId: ticketCandidatesById[binding.ticketRecordId]?.markerPlanId || "",
        markerPlanNo: binding.markerPlanNo || void 0,
        materialSku: ticketCandidatesById[binding.ticketRecordId]?.materialSku || "",
        spreadingSessionId: traceAnchor?.spreadingSessionId || void 0,
        sourceWritebackId: traceAnchor?.sourceWritebackId || void 0,
        ticketId: binding.feiTicketId,
        ticketNo: binding.ticketNo,
        bagId: binding.bagId,
        bagCode: binding.bagCode,
        usageId: binding.usageId,
        usageNo: usageItemsById[binding.usageId]?.usageNo,
        sewingTaskNo: usageItemsById[binding.usageId]?.sewingTaskNo
      })
    };
  }).sort((left, right) => right.boundAt.localeCompare(left.boundAt, "zh-CN"));
  const bindingsByUsageId = Object.fromEntries(
    Object.entries(bindingsByUsageIdRaw).map(([usageId, bindings]) => [
      usageId,
      bindings.map((binding) => bindingItems.find((item) => item.bindingId === binding.bindingId)).filter((item) => Boolean(item))
    ])
  );
  usageItems.forEach((usageItem) => {
    usageItem.bindingItems = bindingsByUsageId[usageItem.usageId] || [];
  });
  const stageLedgerItems = buildTransferBagStageLedgerItems(usageItems);
  const handoverStageItems = stageLedgerItems.filter((item) => item.stage === "HANDOVER_PACKING");
  const stageSummary = {
    inboundTempCount: stageLedgerItems.filter((item) => item.stage === "INBOUND_TEMP").length,
    handoverPackingCount: handoverStageItems.length,
    handoverRelationOkCount: handoverStageItems.filter((item) => item.relationOk).length,
    handoverRelationMissingCount: handoverStageItems.filter((item) => !item.relationOk).length
  };
  const sortingTasks = buildCutPieceSortingTasks(usageItems);
  const sortingTaskSummary = {
    taskCount: sortingTasks.length,
    pendingCount: sortingTasks.filter((task) => task.status === "\u5F85\u5206\u62E3").length,
    sortingCount: sortingTasks.filter((task) => task.status === "\u5206\u62E3\u4E2D").length,
    packedCount: sortingTasks.filter((task) => task.status === "\u5DF2\u88C5\u888B").length,
    handedOverCount: sortingTasks.filter((task) => task.status === "\u5DF2\u4EA4\u51FA" || task.status === "\u5DF2\u56DE\u5199").length,
    sourceTempBagCount: uniqueStrings(sortingTasks.flatMap((task) => task.sourceTempBagNos)).length,
    targetTransferBagCount: uniqueStrings(sortingTasks.flatMap((task) => task.targetTransferBagNos)).length
  };
  return {
    summary: {
      bagCount: masterItems.filter((item) => item.visibleStatusKey !== "ARCHIVED").length,
      idleBagCount: masterItems.filter((item) => item.visibleStatusKey === "IDLE").length,
      inProgressBagCount: masterItems.filter((item) => item.visibleStatusKey === "IN_PROGRESS").length,
      readyHandoverBagCount: masterItems.filter((item) => item.visibleStatusKey === "READY_HANDOVER").length,
      handedOverBagCount: masterItems.filter((item) => item.visibleStatusKey === "HANDED_OVER").length
    },
    masters: masterItems,
    mastersById: Object.fromEntries(masterItems.map((item) => [item.bagId, item])),
    usages: usageItems,
    usagesById: usageItemsById,
    bindings: bindingItems,
    bindingsByUsageId,
    activeTicketBindingsByTicketId,
    manifestsByUsageId,
    sewingTasks: options.store.sewingTasks,
    sewingTasksById,
    auditTrailByUsageId,
    ticketCandidates,
    ticketCandidatesById,
    ticketCandidatesByNo,
    stageSummary,
    stageLedgerItems,
    sortingTaskSummary,
    sortingTasks
  };
}
function deriveCarrierManagementStatus(master) {
  if (master.currentStatus === "DISABLED") return "\u505C\u7528";
  if (master.currentStatus === "WAITING_REPAIR" || master.currentStatus === "WAITING_CLEANING") return "\u5F02\u5E38";
  if (master.currentStatus === "REUSABLE") return "\u5DF2\u56DE\u6536";
  if (master.currentUsage?.usageStatus === "WAITING_RETURN" || master.currentUsage?.usageStatus === "RETURN_INSPECTING") return "\u5F85\u56DE\u6536";
  if (master.currentUsage) return "\u4F7F\u7528\u4E2D";
  return "\u53EF\u7528";
}
function deriveCarrierManagementUseStage(usage) {
  if (!usage) return "\u65E0";
  if (usage.usageStage === "INBOUND_TEMP") return "\u5165\u4ED3\u6682\u5B58";
  if (usage.usageStatus === "DISPATCHED" || usage.usageStatus === "PENDING_SIGNOFF") return "\u7B7E\u6536\u4E2D";
  if (usage.usageStatus === "WAITING_RETURN" || usage.usageStatus === "RETURN_INSPECTING") return "\u56DE\u6536\u4E2D";
  return "\u4EA4\u51FA\u88C5\u888B";
}
function getCarrierUseMixedSummary(usage) {
  const productionOrderCount = usage.productionOrderNos.length;
  const cutOrderCount = usage.cutOrderNos.length;
  const partCount = uniqueStrings(usage.bindingItems.map((item) => item.ticket?.partName || item.partName)).length;
  const sizeCount = uniqueStrings(usage.bindingItems.map((item) => item.ticket?.size || item.size)).length;
  const mixedFlag = usage.usageStage === "INBOUND_TEMP" && (productionOrderCount > 1 || cutOrderCount > 1 || partCount > 1 || sizeCount > 1);
  return {
    mixedFlag,
    mixedSummary: usage.usageStage === "INBOUND_TEMP" ? `\u6D89\u53CA ${productionOrderCount} \u4E2A\u751F\u4EA7\u5355 / ${cutOrderCount} \u5F20\u88C1\u7247\u5355 / ${partCount} \u4E2A\u90E8\u4F4D / ${sizeCount} \u4E2A\u5C3A\u7801` : `\u7ED1\u5B9A ${usage.sewingTaskNo || "\u5F85\u8865\u8F66\u7F1D\u4EFB\u52A1"}\uFF0C${usage.summary.ticketCount} \u5F20\u83F2\u7968`
  };
}
function mapTransferBagDiscrepancyType(type) {
  if (type === "QTY_MISMATCH") return "\u7B7E\u6536\u6570\u91CF\u5DEE\u5F02";
  if (type === "DAMAGED_BAG") return "\u4E2D\u8F6C\u888B\u7834\u635F";
  if (type === "LATE_RETURN") return "\u5E94\u56DE\u6536\u672A\u56DE\u6536";
  if (type === "MISSING_RECORD") return "\u56DE\u6536\u8BB0\u5F55\u7F3A\u5931";
  return "\u5176\u4ED6\u5F02\u5E38";
}
function toTransferBagUseCycleView(usage, abnormalRecords) {
  const mixed = getCarrierUseMixedSummary(usage);
  return {
    bagUseId: usage.usageId,
    bagMasterId: usage.bagId,
    bagCode: usage.bagCode,
    useStage: usage.usageStage === "INBOUND_TEMP" ? "\u5165\u4ED3\u6682\u5B58" : "\u4EA4\u51FA\u88C5\u888B",
    sourceWarehouseId: "cutting-wait-handover",
    sourceWarehouseName: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
    targetObjectType: usage.usageStage === "INBOUND_TEMP" ? "" : "\u8F66\u7F1D\u4EFB\u52A1",
    targetObjectId: usage.usageStage === "INBOUND_TEMP" ? "" : usage.sewingTaskId,
    targetObjectNo: usage.usageStage === "INBOUND_TEMP" ? "" : usage.sewingTaskNo,
    receiverFactoryId: usage.usageStage === "INBOUND_TEMP" ? "" : usage.sewingFactoryId,
    receiverFactoryName: usage.usageStage === "INBOUND_TEMP" ? "\u6682\u4E0D\u7ED1\u5B9A\u63A5\u6536\u5BF9\u8C61" : usage.sewingFactoryName,
    containedFeiTickets: usage.bindingItems.map((binding) => ({
      feiTicketId: binding.feiTicketId,
      feiTicketNo: binding.ticketNo,
      pieceQty: binding.qty,
      productionOrderNo: binding.productionOrderNo,
      cutOrderNo: binding.cutOrderNo,
      partName: binding.ticket?.partName || binding.partName || "\u5F85\u8865\u90E8\u4F4D",
      size: binding.ticket?.size || binding.size || "\u5F85\u8865\u5C3A\u7801"
    })),
    containedPieceQty: usage.summary.quantityTotal,
    startedAt: usage.startedAt || "",
    handedOverAt: usage.dispatchAt || "",
    signedAt: usage.signedAt || "",
    returnedAt: usage.returnedAt || "",
    closedAt: ["CLOSED", "EXCEPTION_CLOSED"].includes(usage.usageStatus) ? usage.returnedAt || usage.signedAt || usage.dispatchAt || "" : "",
    currentStatus: usage.statusMeta.label,
    discrepancyRecords: abnormalRecords.filter((item) => item.relatedUseId === usage.usageId),
    mixedFlag: mixed.mixedFlag,
    mixedSummary: mixed.mixedSummary
  };
}
function buildTransferBagAbnormalRecordsFromStore(store, viewModel) {
  const records = [];
  const usageById = viewModel.usagesById;
  store.returnReceipts.filter((receipt) => receipt.discrepancyType !== "NONE").forEach((receipt) => {
    records.push({
      abnormalId: `ABN-${receipt.returnReceiptId}`,
      bagCode: receipt.bagCode,
      abnormalType: mapTransferBagDiscrepancyType(receipt.discrepancyType),
      relatedUseId: receipt.usageId,
      relatedObjectType: "\u4F7F\u7528\u5468\u671F",
      relatedObjectId: receipt.usageNo,
      description: receipt.discrepancyNote || receipt.note || "\u7B7E\u6536\u6216\u56DE\u6536\u73AF\u8282\u5B58\u5728\u5DEE\u5F02\u3002",
      evidencePhotos: [],
      reportedAt: receipt.returnAt,
      reportedBy: receipt.receivedBy || receipt.returnedBy || "\u56DE\u6536\u9A8C\u6536\u5458",
      handlingStatus: "\u5DF2\u8BB0\u5F55",
      handledAt: "",
      handledBy: ""
    });
  });
  store.conditionRecords.filter((condition) => condition.conditionStatus !== "GOOD" || condition.repairNeeded || condition.reusableDecision !== "REUSABLE").forEach((condition) => {
    records.push({
      abnormalId: `ABN-${condition.conditionRecordId}`,
      bagCode: condition.bagCode,
      abnormalType: condition.reusableDecision === "DISABLED" ? "\u4E2D\u8F6C\u888B\u505C\u7528" : "\u4E2D\u8F6C\u888B\u7834\u635F",
      relatedUseId: condition.usageId,
      relatedObjectType: "\u888B\u51B5\u9A8C\u6536",
      relatedObjectId: condition.conditionRecordId,
      description: condition.damageType || condition.note || "\u888B\u51B5\u5F02\u5E38\uFF0C\u9700\u8981\u5904\u7406\u540E\u518D\u590D\u7528\u3002",
      evidencePhotos: [],
      reportedAt: condition.inspectedAt,
      reportedBy: condition.inspectedBy,
      handlingStatus: condition.reusableDecision === "REUSABLE" ? "\u5DF2\u5904\u7406" : "\u5F85\u5904\u7406",
      handledAt: "",
      handledBy: ""
    });
  });
  store.closureResults.filter((closure) => closure.closureStatus === "EXCEPTION_CLOSED").forEach((closure) => {
    records.push({
      abnormalId: `ABN-${closure.closureId}`,
      bagCode: usageById[closure.usageId]?.bagCode || closure.cycleNo,
      abnormalType: closure.nextBagStatus === "DISABLED" ? "\u4E2D\u8F6C\u888B\u505C\u7528" : "\u5F02\u5E38\u5173\u95ED",
      relatedUseId: closure.usageId,
      relatedObjectType: "\u4F7F\u7528\u5468\u671F",
      relatedObjectId: closure.usageNo,
      description: closure.reason || closure.warningMessages.join("\uFF1B") || "\u672C\u6B21\u4F7F\u7528\u5468\u671F\u5F02\u5E38\u5173\u95ED\u3002",
      evidencePhotos: [],
      reportedAt: closure.closedAt,
      reportedBy: closure.closedBy,
      handlingStatus: "\u5DF2\u5173\u95ED",
      handledAt: closure.closedAt,
      handledBy: closure.closedBy
    });
  });
  const handoverUsage = viewModel.usages.find((usage) => usage.usageStage === "HANDOVER_PACKING" && usage.sewingTaskNo);
  if (handoverUsage) {
    records.push({
      abnormalId: `ABN-MULTI-TASK-${handoverUsage.usageId}`,
      bagCode: handoverUsage.bagCode,
      abnormalType: "\u4E00\u4E2A\u888B\u5C1D\u8BD5\u7ED1\u5B9A\u591A\u4E2A\u8F66\u7F1D\u4EFB\u52A1",
      relatedUseId: handoverUsage.usageId,
      relatedObjectType: "\u4EA4\u51FA\u88C5\u888B\u6821\u9A8C",
      relatedObjectId: handoverUsage.usageNo,
      description: "\u4EA4\u51FA\u88C5\u888B\u9636\u6BB5\u62E6\u622A\u540C\u4E00\u4E2D\u8F6C\u888B\u7ED1\u5B9A\u591A\u4E2A\u8F66\u7F1D\u4EFB\u52A1\uFF1B\u8BE5\u888B\u672C\u8F6E\u53EA\u4FDD\u7559\u5F53\u524D\u8F66\u7F1D\u4EFB\u52A1\u3002",
      evidencePhotos: [],
      reportedAt: handoverUsage.startedAt || handoverUsage.dispatchAt || "",
      reportedBy: "\u4E2D\u8F6C\u888B\u9875\u9762\u6821\u9A8C",
      handlingStatus: "\u5DF2\u62E6\u622A",
      handledAt: handoverUsage.startedAt || "",
      handledBy: "\u4E2D\u8F6C\u888B\u9875\u9762\u6821\u9A8C"
    });
  }
  return records.sort((left, right) => right.reportedAt.localeCompare(left.reportedAt, "zh-CN"));
}
function buildTransferBagCarrierManagementProjection(store, viewModel) {
  const abnormalRecords = buildTransferBagAbnormalRecordsFromStore(store, viewModel);
  const abnormalCountByBag = abnormalRecords.reduce((result, record) => {
    result[record.bagCode] = (result[record.bagCode] || 0) + 1;
    return result;
  }, {});
  const usagesByBag = viewModel.usages.reduce((result, usage) => {
    if (!result[usage.bagId]) result[usage.bagId] = [];
    result[usage.bagId].push(usage);
    return result;
  }, {});
  const masterRecords = viewModel.masters.map((master) => {
    const relatedUsages = (usagesByBag[master.bagId] || []).slice().sort((left, right) => right.usageNo.localeCompare(left.usageNo, "zh-CN"));
    const currentUsage = master.currentUsage;
    const currentUseStage = deriveCarrierManagementUseStage(currentUsage);
    const currentBoundObjectType = !currentUsage ? "" : currentUseStage === "\u5165\u4ED3\u6682\u5B58" ? "\u5165\u4ED3\u6682\u5B58\u8BB0\u5F55" : "\u8F66\u7F1D\u4EFB\u52A1";
    const currentBoundObjectNo = !currentUsage ? "" : currentUseStage === "\u5165\u4ED3\u6682\u5B58" ? currentUsage.usageNo : currentUsage.sewingTaskNo || currentUsage.usageNo;
    return {
      bagMasterId: master.bagId,
      bagCode: master.bagCode,
      bagName: master.bagCode,
      bagSpec: `${master.bagType || "\u4E2D\u8F6C\u888B"} / \u5BB9\u91CF ${master.capacity} \u5F20\u83F2\u7968`,
      bagMaterial: master.carrierType === "box" ? "\u5468\u8F6C\u7BB1" : "\u53EF\u590D\u7528\u8F6F\u888B",
      currentStatus: deriveCarrierManagementStatus(master),
      currentLocation: master.currentLocation || "\u5F85\u547D\u4F4D",
      currentUseStage,
      currentUseId: currentUsage?.usageId || "",
      currentBoundObjectType,
      currentBoundObjectId: currentUseStage === "\u5165\u4ED3\u6682\u5B58" ? currentUsage?.usageId || "" : currentUsage?.sewingTaskId || "",
      currentBoundObjectNo,
      currentFeiTicketCount: master.packedTicketCount,
      currentPieceQty: master.currentTotalPieceCount,
      lastUsedAt: relatedUsages[0]?.startedAt || "",
      lastSignedAt: master.currentSignedAt,
      lastReturnedAt: master.currentReturnedAt,
      totalUseCount: relatedUsages.length,
      abnormalCount: abnormalCountByBag[master.bagCode] || 0,
      enabled: master.currentStatus !== "DISABLED",
      createdAt: "2026-03-01 08:00",
      createdBy: "\u88C1\u5E8A\u4ED3\u7BA1"
    };
  });
  const useCycles = viewModel.usages.map((usage) => toTransferBagUseCycleView(usage, abnormalRecords));
  const handoverPackingUses = useCycles.filter((cycle) => cycle.useStage === "\u4EA4\u51FA\u88C5\u888B");
  const signedAndReturnUses = useCycles.filter((cycle) => cycle.signedAt || cycle.returnedAt || ["\u5F85\u56DE\u4ED3", "\u56DE\u6536\u4E2D", "\u5DF2\u5173\u95ED", "\u5F02\u5E38\u5173\u95ED"].includes(cycle.currentStatus));
  const taskBagGroups = Object.values(
    handoverPackingUses.reduce((result, cycle) => {
      const key = cycle.targetObjectNo || "\u672A\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1";
      if (!result[key]) {
        result[key] = {
          sewingTaskNo: key,
          receiverFactoryName: cycle.receiverFactoryName,
          bagCodes: [],
          useCount: 0
        };
      }
      result[key].bagCodes.push(cycle.bagCode);
      result[key].bagCodes = uniqueStrings(result[key].bagCodes);
      result[key].useCount += 1;
      return result;
    }, {})
  ).filter((item) => item.bagCodes.length > 1);
  return {
    overviewCards: [
      { label: "\u4E2D\u8F6C\u888B\u6863\u6848", value: masterRecords.length, hint: "\u53EF\u590D\u7528\u8F7D\u5177\u4E3B\u6863" },
      { label: "\u5165\u4ED3\u6682\u5B58\u4F7F\u7528", value: useCycles.filter((cycle) => cycle.useStage === "\u5165\u4ED3\u6682\u5B58").length, hint: "\u5141\u8BB8\u6DF7\u88C5\uFF0C\u4E0D\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1" },
      { label: "\u4EA4\u51FA\u88C5\u888B\u4F7F\u7528", value: handoverPackingUses.length, hint: "\u4E00\u4E2A\u888B\u53EA\u7ED1\u5B9A\u4E00\u4E2A\u8F66\u7F1D\u4EFB\u52A1" },
      { label: "\u7B7E\u6536\u4E0E\u56DE\u6536", value: signedAndReturnUses.length, hint: "\u7B7E\u6536\u3001\u8FD4\u4ED3\u3001\u590D\u7528\u95ED\u73AF" },
      { label: "\u5F02\u5E38\u8BB0\u5F55", value: abnormalRecords.length, hint: "\u7834\u635F\u3001\u4E22\u5931\u3001\u9519\u626B\u3001\u5DEE\u5F02" }
    ],
    masterRecords,
    inboundTempUses: useCycles.filter((cycle) => cycle.useStage === "\u5165\u4ED3\u6682\u5B58"),
    handoverPackingUses,
    signedAndReturnUses,
    abnormalRecords,
    taskBagGroups
  };
}
export {
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
  applyPocketBindingLocksToTicketRecords,
  buildActiveTicketPocketBindingMap,
  buildBagUsageAuditTrail,
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel,
  buildSystemSeedTransferBagStore,
  buildTransferBagCarrierManagementProjection,
  buildTransferBagNavigationPayload,
  buildTransferBagParentChildSummary,
  buildTransferBagViewModel,
  buildWarehouseQueryPayload,
  createTransferBagDispatchManifest,
  createTransferBagUsageDraft,
  derivePocketCarrierStatus,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  deriveTransferBagVisibleStatusFromMaster,
  deriveTransferBagVisibleStatusFromUsage,
  deriveTransferBagVisibleStatusMeta,
  deserializeTransferBagSelectedTicketIds,
  deserializeTransferBagStorage,
  ensureUsageContextLockedByTicket,
  getTransferBagDemoCaseIds,
  getTransferBagRuleLabel,
  getTransferBagTicketPrintStatusLabel,
  getTransferBagUsageStageLabel,
  isInboundTempTransferBagUsage,
  isTransferBagUsageActiveStatus,
  mapUsageStatusToPocketCarrierStatus,
  mergeTransferBagStores,
  resolveTransferBagCycleContextFromTicket,
  serializeTransferBagSelectedTicketIds,
  serializeTransferBagStorage,
  validateBagToSewingTaskBinding,
  validateTicketBindingEligibility
};
