// ============================================================================
// ID & Code Generation Utilities
// Pure functions for generating transfer numbers, subject IDs, warehouse codes,
// and material transfer drafts.
// Source: App.tsx lines 878-892, 3278-3288, 7687-7702
// ============================================================================

import type {
  MaterialTransferDraft,
  StockTransferRecord,
  Subject,
  Warehouse,
} from "../types";

/** Generate a unique material transfer order number with date-based sequence. */
export const makeMaterialTransferNo = () => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `MFT-${date}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
};

/** Create a blank material transfer draft with a generated transfer number. */
export const createMaterialTransferDraft = (): MaterialTransferDraft => ({
  transfer_no: makeMaterialTransferNo(),
  from_warehouse: "原料仓库",
  to_warehouse: "中转仓库",
  reason: "中转调拨",
  remark: "",
  selectedPackageCodes: [],
  lines: [],
});

/** Generate a sequential stock transfer number based on existing records for today. */
export const makeStockTransferNo = (records: StockTransferRecord[]) => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `DB-${datePart}-`;
  const maxSeq = records.reduce((max, item) => {
    if (!item.transferNo.startsWith(prefix)) return max;
    const seq = Number(item.transferNo.slice(prefix.length));
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
};

/** Generate the next subject ID by scanning existing subject IDs (ZT-prefixed). */
export const makeSubjectId = (items: Subject[]) => {
  const maxId = items.reduce((max, item) => {
    const num = Number(item.id.replace("ZT", ""));
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 1000);
  return `ZT${String(maxId + 1).padStart(4, "0")}`;
};

/** Generate the next warehouse code by scanning existing warehouse codes. */
export const makeWarehouseCode = (items: Warehouse[]) => {
  const maxId = items.reduce((max, item) => {
    const matched = item.code.match(/(\d+)$/);
    const num = matched ? Number(matched[1]) : 0;
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);
  return `WH-BDG-${String(maxId + 1).padStart(3, "0")}`;
};
