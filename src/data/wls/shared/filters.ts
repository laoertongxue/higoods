// ============================================================================
// Filter / Status / Mapping Utilities
// Pure functions for status determination, badge styling, unit normalisation,
// PDA status mapping, fulfillment mode logic, and pre-outbound order helpers.
// Source: App.tsx lines 1027-1111, 1204-1211, 3190-3238, 6528-6563
// ============================================================================

import type {
  FulfillmentMode,
  MaterialCategory,
  PdaMaterialTransferOrder,
  PdaMaterialTransferStatus,
  PreInboundBaseUnit,
  PreInboundPackageUnit,
  PreInboundStatus,
  PreOutboundOrder,
  ReturnOrderStatus,
  TransferOrder,
  TransferOrderDetail,
  TransferOrderStatus,
  UserRole,
} from "../types";

// ── Pre-Inbound unit helpers ────────────────────────────────────────────────

/** Type-guard: is the given string a valid pre-inbound package unit? */
export const isPreInboundPackageUnit = (unit: string): unit is PreInboundPackageUnit =>
  unit === "箱" || unit === "卷" || unit === "包" || unit === "袋";

/** Coerce an arbitrary string to a valid PreInboundPackageUnit (defaults to "包"). */
export const normalizePreInboundPackageUnit = (unit: string): PreInboundPackageUnit =>
  isPreInboundPackageUnit(unit) ? unit : "包";

/** Type-guard: is the given string a valid pre-inbound base unit? */
export const isPreInboundBaseUnit = (unit: string): unit is PreInboundBaseUnit =>
  unit === "颗" || unit === "米" || unit === "个" || unit === "kg";

/** Coerce an arbitrary string to a valid PreInboundBaseUnit (defaults to "个"). */
export const normalizePreInboundBaseUnit = (unit: string): PreInboundBaseUnit =>
  isPreInboundBaseUnit(unit) ? unit : "个";

// ── Pre-Inbound / Receive status helpers ────────────────────────────────────

/** Derive the pre-inbound receiving status from quantity values. */
export const getPreInboundStatus = (receivedQuantity: number, deliveryQuantity: number): PreInboundStatus => {
  if (receivedQuantity <= 0) return "待收货";
  if (receivedQuantity < deliveryQuantity) return "部分收货";
  return "全部收货";
};

/** Return Tailwind CSS classes for a receive/PDA status badge. */
export const getReceiveStatusBadgeClass = (status: PreInboundStatus | ReturnOrderStatus) => {
  if (status === "异常待处理") return "bg-[#FEE4E2] text-[#B42318]";
  if (status === "待收货") return "bg-[#F2F4F7] text-[#475467]";
  if (status === "收货中") return "bg-[#EEF4FF] text-[#175CD3]";
  if (status === "质检中" || status === "入库中") return "bg-[#EEF4FF] text-[#175CD3]";
  if (status === "部分收货") return "bg-[#FFEAD5] text-[#B54708]";
  if (status === "待质检" || status === "待入库" || status === "待上架" || status === "部分上架") return "bg-[#FFEAD5] text-[#B54708]";
  return "bg-[#D1FADF] text-[#067647]";
};

// ── PDA task helpers ────────────────────────────────────────────────────────

/** Return the CSS class for a PDA task action button based on enabled state. */
export const getPdaTaskActionToneClass = (enabled: boolean, enabledClass: string) =>
  enabled ? enabledClass : "bg-[#D0D5DD] text-white";

/** Return the CSS class for a PDA task status badge. */
export const getPdaTaskStatusBadgeClass = (status: string) => {
  if (status.includes("部分")) return "bg-[#FFEAD5] text-[#B54708]";
  if (status.includes("中")) return "bg-[#EEF4FF] text-[#175CD3]";
  if (status.includes("完成") || status.startsWith("已")) return "bg-[#D1FADF] text-[#067647]";
  return "bg-[#F2F4F7] text-[#475467]";
};

/** Return the display label for a PDA task status option (prefixes partial statuses). */
export const getPdaTaskStatusOptionLabel = (status: string) => (status.includes("部分") ? `?? ${status}` : status);

// ── Fulfillment mode helpers ────────────────────────────────────────────────

/** Determine the fulfillment mode for a pre-outbound order. */
export const getFulfillmentModeByOrder = (order: PreOutboundOrder): FulfillmentMode => {
  if (order.fulfillmentMode) return order.fulfillmentMode;
  const skuKinds = new Set(order.productItems.map((item) => item.sku)).size;
  const totalQty = order.productItems.reduce((sum, item) => sum + Math.max(0, Math.floor(item.outboundQuantity || 0)), 0);
  return skuKinds === 1 && totalQty === 1 ? "SINGLE_SCAN_SHIP" : "STANDARD_REVIEW_SHIP";
};

/** Return the Chinese label for a fulfillment mode. */
export const getFulfillmentModeLabel = (mode: FulfillmentMode) => {
  switch (mode) {
    case "SINGLE_SCAN_SHIP":
      return "单件快发";
    case "STANDARD_SHIP":
      return "标准发货";
    case "STANDARD_REVIEW_SHIP":
      return "标准复核";
    default:
      return "未知模式";
  }
};

/** Check whether the given user role can confirm web shipments. */
export const canWebConfirmShipByRole = (role: UserRole) => role === "管理员" || role === "仓库主管";

// ── Pre-Outbound order helpers ──────────────────────────────────────────────

/** Check whether a pre-outbound order has multiple items (multi-SKU or qty > 1). */
export const isMultiItemBasketOrder = (order: PreOutboundOrder) => {
  const effectiveItems = order.productItems.filter((product) => Math.max(0, product.outboundQuantity - (product.shippedQuantity || 0)) > 0);
  const effectiveSkuCount = new Set(effectiveItems.map((product) => product.sku)).size;
  const effectiveQty = effectiveItems.reduce((sum, product) => sum + Math.max(0, product.outboundQuantity - (product.shippedQuantity || 0)), 0);
  return effectiveSkuCount > 1 || effectiveQty > 1;
};

/** Get the SKU count for a pre-outbound order (uses cached value or computes). */
export const getPreOutboundSkuCount = (order: PreOutboundOrder) =>
  order.sku_count ?? new Set(order.productItems.map((product) => product.sku).filter(Boolean)).size;

/** Get the total item quantity for a pre-outbound order (uses cached value or computes). */
export const getPreOutboundItemTotalQty = (order: PreOutboundOrder) =>
  order.item_total_qty ?? order.productItems.reduce((sum, product) => sum + Math.max(0, product.outboundQuantity || 0), 0);

/** Determine whether a pre-outbound order is single-SKU, multi-SKU, or unknown. */
export const getPreOutboundOrderItemType = (order: PreOutboundOrder): "SINGLE_SKU" | "MULTI_SKU" | "UNKNOWN" => {
  const skuCount = getPreOutboundSkuCount(order);
  if (skuCount <= 0) return "UNKNOWN";
  return skuCount > 1 ? "MULTI_SKU" : "SINGLE_SKU";
};

/** Normalise a date-time input value by trimming and replacing T with space. */
export const normalizeDateTimeInputValue = (value: string) => value.trim().replace("T", " ");

/** Add the given number of hours to a date-time string value. */
export const addHoursToDateTimeText = (value: string, hours: number) => {
  const normalized = normalizeDateTimeInputValue(value);
  const time = new Date(normalized.replace(" ", "T")).getTime();
  if (!Number.isFinite(time)) return normalized;
  const next = new Date(time + hours * 60 * 60 * 1000);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())} ${pad(next.getHours())}:${pad(next.getMinutes())}:${pad(next.getSeconds())}`;
};

/** Get a specific time value from a pre-outbound order by time type. */
export const getPreOutboundTimeValue = (order: PreOutboundOrder, timeType: "CREATE_TIME" | "PAY_TIME" | "SHIP_DEADLINE") => {
  const createTime = order.created_at || order.create_time || order.orderTime || "";
  if (timeType === "PAY_TIME") return order.pay_time || addHoursToDateTimeText(createTime, -2);
  if (timeType === "SHIP_DEADLINE") return order.ship_deadline_time || addHoursToDateTimeText(createTime, 72);
  return createTime;
};

// ── Transfer / Material mapping helpers ─────────────────────────────────────

/** Map a transfer order status to the corresponding PDA material transfer status. */
export const toPdaMaterialTransferStatus = (status: TransferOrderStatus): PdaMaterialTransferStatus => {
  if (status === "WAIT_PICK") return "WAIT_PICK";
  if (status === "PICKING") return "PICKING";
  if (status === "WAIT_SEND") return "WAIT_SEND";
  if (status === "IN_TRANSIT") return "IN_TRANSIT";
  if (status === "WAIT_SIGN") return "WAIT_SIGN";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "EXCEPTION") return "EXCEPTION";
  return "WAIT_PICK";
};

/** Map a MaterialCategory code to its Chinese display name. */
export const toMaterialCategoryName = (category: MaterialCategory): string => {
  switch (category) {
    case "FABRIC":
      return "面料";
    case "ACCESSORY":
      return "辅料";
    case "YARN":
      return "纱线";
    case "CONSUMABLE":
      return "耗材";
    case "PACKAGING":
      return "包材";
    default:
      return "物料";
  }
};

/** Map a TransferOrder with its detail lines into a PdaMaterialTransferOrder. */
export const mapTransferOrderToPda = (order: TransferOrder, allDetails: TransferOrderDetail[]): PdaMaterialTransferOrder => {
  const lines = allDetails
    .filter((detail) => detail.transfer_no === order.transfer_no)
    .map((detail, index) => ({
      id: `${order.transfer_no}-${detail.sku_code}-${index}`,
      materialCategory: detail.material_category,
      spu: detail.spu_code,
      sku: detail.sku_code,
      productName: `${toMaterialCategoryName(detail.material_category)}物料`,
      packageUnit: detail.package_unit,
      baseUnit: detail.base_unit,
      qty: detail.package_qty,
      baseQty: detail.base_qty,
      availableQty: Math.max(detail.package_qty, detail.package_qty + 2),
      availableBaseQty: Math.max(detail.base_qty, detail.base_qty + 2 * detail.base_qty),
    }));

  return {
    transferNo: order.transfer_no,
    fromWarehouse: order.from_warehouse,
    toWarehouse: order.to_warehouse,
    status: toPdaMaterialTransferStatus(order.status),
    creator: order.creator,
    createdAt: order.create_time,
    remark: order.remark || "",
    lines,
  };
};
