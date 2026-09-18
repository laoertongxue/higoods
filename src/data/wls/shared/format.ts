// Auto-extracted from Higood-wms App.tsx — format utilities

import type {
  PreOutboundOrder,
  TransitProcessOrder,
} from "../types";

// ── Date/time formatting ──

export const formatShortPackageDate = (printDate: string | Date) => {
  const raw = printDate instanceof Date ? printDate.toISOString().slice(0, 10) : String(printDate || "").trim();
  const matched = raw.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
  if (!matched) {
    throw new Error("打印日期无效，无法生成包装码。");
  }
  return `${matched[1].slice(-2)}${matched[2]}${matched[3]}`;
};

export const formatLocalDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

export const getTransitPresetDateRange = (preset: "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CUSTOM") => {
  const end = new Date();
  const start = new Date(end);
  if (preset === "LAST_7_DAYS") start.setDate(start.getDate() - 6);
  if (preset === "LAST_30_DAYS") start.setDate(start.getDate() - 29);
  return { start: formatLocalDateValue(start), end: formatLocalDateValue(end) };
};

export const getTransitRecordDate = (value?: string) => value?.slice(0, 10) || "";

export const isTransitDateInRange = (value: string | undefined, start: string, end: string) => {
  const date = getTransitRecordDate(value);
  return Boolean(date && date >= start && date <= end);
};

export const formatOutboundTime = (row: Pick<PreOutboundOrder, "create_time" | "pick_time" | "outbound_time" | "orderTime" | "pickTime" | "printTime" | "stockDeductedTime">) => [
  { label: "创建", value: row.create_time || row.orderTime || "-" },
  { label: "拣货", value: row.pick_time || row.pickTime || "-" },
  { label: "出库", value: row.outbound_time || row.stockDeductedTime || row.printTime || "-" },
];

// ── Number/quantity formatting ──

export const getRatioText = (numerator: number, denominator: number) => {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(2)}%`;
};

export const getRatioValue = (numerator: number, denominator: number) => {
  if (!denominator) return 0;
  return numerator / denominator;
};

export const getRatioLevelClass = (numerator: number, denominator: number) => {
  const ratioPercent = getRatioValue(numerator, denominator) * 100;
  if (ratioPercent > 50) return "text-red-600";
  if (ratioPercent > 30) return "text-amber-500";
  return "text-emerald-600";
};

// ── Pagination helpers ──

export const getVisiblePages = (page: number, totalPages: number) => {
  if (totalPages <= 10) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 6) {
    return [1, 2, 3, 4, 5, 6, 7, 8, "ellipsis", totalPages - 1, totalPages] as const;
  }

  if (page >= totalPages - 5) {
    return [1, 2, "ellipsis", totalPages - 7, totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", page - 2, page - 1, page, page + 1, page + 2, "ellipsis", totalPages] as const;
};

// ── Transit print pagination ──

export type TransitReceiptPrintLine = {
  sequence: number;
  sku: string;
  materialName: string;
  unit: string;
  requiredQty: number;
  inventoryQty: number;
  deliveryQty: number;
  remark: string;
};

export type TransitReceiptPrintGroup = {
  inboundNo: string;
  productionNo: string;
  processorName: string;
  expectedSkuCount: number;
  deliverySkuCount: number;
  lines: TransitReceiptPrintLine[];
};

export type TransitReceiptPrintDocument = {
  receiveNo: string;
  processorType: string;
  processorName: string;
  receiveStatus: string;
  expectedSkuCount: number;
  expectedQty: number;
  deliveryQty: number;
  printTime: string;
  operator: string;
  groups: TransitReceiptPrintGroup[];
};

const TRANSIT_RECEIPT_PAGE_CAPACITY = 10;

export const paginateTransitReceiptGroups = (groups: TransitReceiptPrintGroup[]) => {
  const pages: TransitReceiptPrintGroup[][] = [];
  let currentPage: TransitReceiptPrintGroup[] = [];
  let usedCapacity = 0;

  const flushPage = () => {
    if (currentPage.length > 0) pages.push(currentPage);
    currentPage = [];
    usedCapacity = 0;
  };

  groups.forEach((group) => {
    const groupLines = group.lines.length > 0 ? group.lines : [{
      sequence: 1,
      sku: "-",
      materialName: "-",
      unit: "-",
      requiredQty: 0,
      inventoryQty: 0,
      deliveryQty: 0,
      remark: "",
    }];
    let offset = 0;
    while (offset < groupLines.length) {
      if (TRANSIT_RECEIPT_PAGE_CAPACITY - usedCapacity <= 1) flushPage();
      const availableLineCount = Math.max(1, TRANSIT_RECEIPT_PAGE_CAPACITY - usedCapacity - 1);
      const segmentLines = groupLines.slice(offset, offset + availableLineCount);
      currentPage.push({ ...group, lines: segmentLines });
      usedCapacity += segmentLines.length + 1;
      offset += segmentLines.length;
      if (offset < groupLines.length) flushPage();
    }
  });
  flushPage();
  return pages.length > 0 ? pages : [[]];
};

export type TransitPostReceiptTaskKind = "DIRECT" | "COMBINED" | "PUTAWAY";

export type TransitPostReceiptTaskPrintLine = {
  sequence: number;
  sku: string;
  image: string;
  materialName: string;
  unit: string;
  requiredQty: number;
  receivedQty: number;
  batchAllocationQty: number;
  shelfPickQty: number;
  shelfPickLocation: string;
  recommendedLocation: string;
  missingQty: number;
  putawayQty: number;
};

export type TransitPostReceiptTaskPrintGroup = {
  inboundNo: string;
  productionNo: string;
  processorType: string;
  processorName: string;
  taskKind: TransitPostReceiptTaskKind;
  taskTitle: string;
  kitResult: string;
  taskNo: string;
  taskStatus: string;
  generatedTime: string;
  recommendedTargetLocation: string;
  batchMaterialQty: number;
  shelfMaterialQty: number;
  lines: TransitPostReceiptTaskPrintLine[];
};

export type TransitPostReceiptTaskPrintDocument = {
  receiveNo: string;
  processorType: string;
  processorName: string;
  receiveCompletedTime: string;
  kitCheckedTime: string;
  inboundCount: number;
  productionCount: number;
  directTaskCount: number;
  combinedTaskCount: number;
  putawayTaskCount: number;
  printTime: string;
  operator: string;
  groups: TransitPostReceiptTaskPrintGroup[];
};

const TRANSIT_POST_RECEIPT_TASK_PAGE_CAPACITY = 14;

export const paginateTransitPostReceiptTaskGroups = (groups: TransitPostReceiptTaskPrintGroup[]) => {
  const pages: TransitPostReceiptTaskPrintGroup[][] = [];
  let currentPage: TransitPostReceiptTaskPrintGroup[] = [];
  let usedCapacity = 0;

  const flushPage = () => {
    if (currentPage.length > 0) pages.push(currentPage);
    currentPage = [];
    usedCapacity = 0;
  };

  groups.forEach((group) => {
    let offset = 0;
    while (offset < group.lines.length) {
      if (TRANSIT_POST_RECEIPT_TASK_PAGE_CAPACITY - usedCapacity <= 1) flushPage();
      const availableLineCount = Math.max(1, TRANSIT_POST_RECEIPT_TASK_PAGE_CAPACITY - usedCapacity - 1);
      const segmentLines = group.lines.slice(offset, offset + availableLineCount);
      currentPage.push({ ...group, lines: segmentLines });
      usedCapacity += segmentLines.length + 1;
      offset += segmentLines.length;
      if (offset < group.lines.length) flushPage();
    }
  });
  flushPage();
  return pages.length > 0 ? pages : [[]];
};
