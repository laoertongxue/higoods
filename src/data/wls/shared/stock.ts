/**
 * Stock calculation, pre-outbound status normalization, and transit display utilities.
 */

import type {
  PreOutboundOrder,
  StockRealtimeItem,
  MaterialStockStatusCode,
  MaterialStockLineJudgement,
  MaterialStockCheckResult,
  MaterialStockCheckLine,
  FactoryConfirmStatusCode,
  MaterialPickingStatusCode,
  MaterialRequisitionStatusCode,
  FactoryMaterialPickingCallback,
  TransitProcessOrder,
  TransitPreInboundDisplayStatus,
} from "../types";
import { MATERIAL_STOCK_STATUS_LABEL } from "./warehouse-config";

/**
 * Set of material units that should be rounded to integers.
 */
export const INTEGER_MATERIAL_UNITS = new Set(["件", "颗", "个", "条", "粒", "枚", "PCS", "pc", "pcs"]);

/**
 * Threshold below which a stock line is considered insufficient rather than partial.
 */
const MATERIAL_STOCK_PARTIAL_THRESHOLD = 0.3;

/**
 * Round a material quantity based on its unit.
 * Integer units are floored; others are floored to 3 decimal places.
 */
export const roundMaterialQtyByUnit = (qty: number, unit?: string): number => {
  const normalizedQty = Math.max(0, Number.isFinite(qty) ? qty : 0);
  if (unit && INTEGER_MATERIAL_UNITS.has(unit)) return Math.floor(normalizedQty);
  return Math.floor(normalizedQty * 1000) / 1000;
};

/**
 * Calculate available stock quantity from a stock realtime item.
 */
export const getAvailableStockQuantity = (
  stock?: Pick<StockRealtimeItem, "spotStock" | "pendingShipmentQuantity" | "preSaleOrderOccupiedQuantity" | "spotOrderOccupiedQuantity">,
): number =>
  Math.max(
    0,
    (stock?.spotStock || 0) -
      (stock?.pendingShipmentQuantity || 0) -
      (stock?.preSaleOrderOccupiedQuantity || 0) -
      (stock?.spotOrderOccupiedQuantity || 0),
  );

/**
 * Check whether a material picking status should be visible on PDA.
 */
export const isMaterialPickingPdaVisible = (status?: MaterialPickingStatusCode): boolean =>
  status === "WAIT_PICKING" || status === "PICKING";

/**
 * Calculate material stock check results for a list of pre-outbound product items.
 */
export const calculateMaterialStockCheck = (
  products: PreOutboundOrder["productItems"],
  stockBySku: Map<string, StockRealtimeItem>,
): MaterialStockCheckResult => {
  const lines: MaterialStockCheckLine[] = products.map((product) => {
    const requiredQty = Math.max(0, Number(product.outboundQuantity) || 0);
    const isRequired = product.isRequired !== false;
    const matchedStock = stockBySku.get(product.sku);
    const availableStock = product.availableStock ?? getAvailableStockQuantity(matchedStock);
    const fulfillRate = requiredQty > 0 ? availableStock / requiredQty : 1;
    const cappedRate = Math.max(0, Math.min(fulfillRate, 1));
    const stockJudgement: MaterialStockLineJudgement =
      fulfillRate >= 1 ? "SUFFICIENT" : fulfillRate >= MATERIAL_STOCK_PARTIAL_THRESHOLD ? "PARTIAL_SUFFICIENT" : "INSUFFICIENT";

    return {
      id: product.id,
      sku: product.sku,
      materialName: product.materialName || matchedStock?.productName,
      isRequired,
      requiredQty,
      availableStock,
      fulfillRate,
      suggestedPickingQuantity: roundMaterialQtyByUnit(Math.min(requiredQty, requiredQty * cappedRate, availableStock), product.unit),
      stockJudgement,
      unit: product.unit,
    };
  });
  const requiredLines = lines.filter((line) => line.isRequired);
  const available_ratio = requiredLines.length > 0 ? Math.min(...requiredLines.map((line) => line.fulfillRate)) : 1;
  const hasInsufficientLine = requiredLines.some((line) => line.fulfillRate < MATERIAL_STOCK_PARTIAL_THRESHOLD);
  const hasPartialLine = requiredLines.some((line) => line.fulfillRate < 1);
  const stock_status: MaterialStockStatusCode = hasInsufficientLine
    ? "STOCK_INSUFFICIENT"
    : hasPartialLine
      ? "STOCK_PARTIAL_SUFFICIENT"
      : "STOCK_SUFFICIENT";

  return {
    stock_status,
    stockStatus: MATERIAL_STOCK_STATUS_LABEL[stock_status],
    factory_confirm_status: (stock_status === "STOCK_PARTIAL_SUFFICIENT" ? "PENDING_CONFIRM" : "NOT_REQUIRED") as FactoryConfirmStatusCode,
    picking_status:
      stock_status === "STOCK_SUFFICIENT"
        ? "WAIT_PICKING"
        : stock_status === "STOCK_PARTIAL_SUFFICIENT"
          ? "DRAFT"
          : "CANCELLED",
    requisition_status:
      stock_status === "STOCK_INSUFFICIENT"
        ? "STOCK_INSUFFICIENT"
        : "STOCK_CHECKED",
    available_ratio,
    need_factory_confirm: stock_status === "STOCK_PARTIAL_SUFFICIENT",
    lines,
  };
};

/**
 * Apply material stock check results to a pre-outbound order, updating all derived fields.
 */
export const applyMaterialStockCheckToOrder = (
  order: PreOutboundOrder,
  stockRows: StockRealtimeItem[],
): PreOutboundOrder => {
  const stockBySku = new Map(
    stockRows
      .filter((stock) => stock.warehouseName === order.outboundWarehouse)
      .map((stock) => [stock.sku, stock] as const),
  );
  const result = calculateMaterialStockCheck(order.productItems, stockBySku);
  const productItems = order.productItems.map((product) => {
    const line = result.lines.find((item) => item.id === product.id);
    return line
      ? {
          ...product,
          materialName: product.materialName || line.materialName,
          isRequired: line.isRequired,
          availableStock: line.availableStock,
          fulfillRate: line.fulfillRate,
          plannedPickQuantity: line.suggestedPickingQuantity,
          suggestedPickingQuantity: line.suggestedPickingQuantity,
          stockJudgement: line.stockJudgement,
          pickedQuantity: result.stock_status === "STOCK_PARTIAL_SUFFICIENT" ? 0 : product.pickedQuantity,
          reviewedQuantity: result.stock_status === "STOCK_PARTIAL_SUFFICIENT" ? 0 : product.reviewedQuantity,
        }
      : product;
  });
  const pickedQuantity = productItems.reduce((sum, product) => sum + Math.max(0, product.pickedQuantity || 0), 0);
  const factoryCallbackPayload: FactoryMaterialPickingCallback | undefined =
    result.stock_status === "STOCK_PARTIAL_SUFFICIENT"
      ? {
          requisition_no: order.outboundOrderNo,
          factory_order_no: order.relatedOrderNo,
          stock_status: result.stock_status,
          available_ratio: result.available_ratio,
          picking_no: order.pickOrderNo,
          picking_status: result.picking_status,
          factory_confirm_status: result.factory_confirm_status,
          need_factory_confirm: true,
          material_lines: result.lines.map((line) => ({
            sku_code: line.sku,
            required_qty: line.requiredQty,
            planned_pick_qty: line.suggestedPickingQuantity,
            actual_pick_qty: 0,
            unit: line.unit,
            fulfill_rate: line.fulfillRate,
          })),
          callback_time: order.pickTime || order.orderTime,
        }
      : undefined;

  return {
    ...order,
    productItems,
    reviewedQuantity: result.stock_status === "STOCK_PARTIAL_SUFFICIENT" ? pickedQuantity : order.reviewedQuantity,
    stockStatus: result.stockStatus as PreOutboundOrder["stockStatus"],
    stock_status: result.stock_status,
    factory_confirm_status: result.factory_confirm_status,
    picking_status: result.picking_status,
    requisition_status: result.requisition_status,
    available_ratio: result.available_ratio,
    need_factory_confirm: result.need_factory_confirm,
    is_pda_visible: isMaterialPickingPdaVisible(result.picking_status),
    planned_pick_qty: result.lines.reduce((sum, line) => sum + Math.max(0, line.suggestedPickingQuantity || 0), 0),
    actual_pick_qty: productItems.reduce((sum, product) => sum + Math.max(0, product.pickedQuantity || 0), 0),
    reservation_status:
      result.stock_status === "STOCK_PARTIAL_SUFFICIENT"
        ? "DRAFT_RESERVED"
        : result.stock_status === "STOCK_SUFFICIENT"
          ? "RESERVED"
          : "NONE",
    factoryCallbackPayload,
  };
};

/**
 * Get the display status for a transit pre-inbound order.
 */
export const getTransitPreInboundDisplayStatus = (order: TransitProcessOrder): TransitPreInboundDisplayStatus => {
  if (order.pre_inbound_document_status === "VOIDED") return "已失效";
  if (order.receive_status === "NOT_RECEIVED") return "待收货";
  if (order.receive_status === "PART_RECEIVED") return "部分收货";
  return "已收货";
};

/**
 * Normalize a pre-outbound order's status based on its quantities.
 */
export const normalizePreOutboundStatus = (order: PreOutboundOrder): PreOutboundOrder => {
  const totalPlannedQuantity = order.productItems.reduce((sum, product) => sum + Math.max(0, product.outboundQuantity || 0), 0);
  const totalPickedQuantity = order.productItems.reduce((sum, product) => sum + Math.max(0, product.pickedQuantity || 0), 0);
  const totalShippedQuantity = order.productItems.reduce((sum, product) => sum + Math.max(0, product.shippedQuantity || 0), 0);
  const rawStatus = order.status as string;
  const status: PreOutboundOrder["status"] =
    rawStatus === "已取消"
      ? "已取消"
      : rawStatus === "已出库" || (totalPlannedQuantity > 0 && totalShippedQuantity >= totalPlannedQuantity)
        ? "已出库"
        : rawStatus === "待处理"
          ? "待处理"
          : rawStatus === "待拣货" || totalPickedQuantity <= 0
            ? "待拣货"
            : rawStatus === "拣货中"
              ? "拣货中"
              : "待出库";

  return {
    ...order,
    status,
    create_time: order.create_time || order.orderTime || "",
    pick_time: order.pick_time || order.pickTime || "",
    outbound_time: order.outbound_time || order.stockDeductedTime || order.printTime || "",
  };
};
