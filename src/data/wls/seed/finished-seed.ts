// ============================================================================
// Finished-goods warehouse seed data
// Source: App.tsx lines ~5139-6690
// Covers: returnOrderSeed, preOutboundAutoSeed, preOutboundOutboundListSeed,
//         preOutboundTestSeed, preOutboundMaterialRequisitionSeed,
//         materialCategoryOutboundDemoSeed, preOutboundSeed (combined),
//         generatedWaveSeed, pickingBasketSeed
// ============================================================================

import type {
  ReturnOrder,
  ReturnOrderStatus,
  ReturnQualityResult,
  PreOutboundOrder,
  PreOutboundStatus,
  OutboundOrderStatus,
  OutboundType,
  FulfillmentMode,
  MaterialCategory,
  WarehouseBizType,
  StockRealtimeItem,
  MaterialStockStatusCode,
  MaterialStockLineJudgement,
  MaterialPickingStatusCode,
  MaterialRequisitionStatusCode,
  FactoryConfirmStatusCode,
  FactoryMaterialPickingCallback,
  MaterialStockCheckResult,
  MaterialStockCheckLine,
  GeneratedWaveRecord,
  PickingBasket,
  BasketStatus,
  BasketType,
} from "../types";

import { subjectSeed, warehouseSeed } from "./shared-seed";
import { stockRealtimeSeed } from "./stock-seed";

// ---------------------------------------------------------------------------
// Local helpers & constants (extracted from App.tsx, pure data — no React)
// ---------------------------------------------------------------------------

const RETURN_STATUS_FLOW: ReturnOrderStatus[] = [
  "待收货", "待质检", "待入库", "待上架", "已完成",
];

const getOutboundTypeByRelatedOrderNo = (relatedOrderNo: string): OutboundType => {
  if (relatedOrderNo.startsWith("XS-")) return "成衣销售出库";
  if (relatedOrderNo.startsWith("YL-")) return "原料领料出库";
  if (relatedOrderNo.startsWith("ZZ-")) return "中转配料出库";
  if (relatedOrderNo.startsWith("YS-")) return "预售出库";
  return "调拨出库";
};

const warehouseTypeCodeMap: Record<WarehouseBizType, string> = {
  FINISHED: "GMT",
  RAW_MATERIAL: "FAB",
  FABRIC: "FAB",
  ACCESSORY: "TRM",
  PACKAGING: "PKG",
  YARN: "YRN",
  CONSUMABLE: "CON",
  TRANSIT: "TSF",
};

// ── Material stock check helpers ─────────────────────────────────────────────

const MATERIAL_STOCK_PARTIAL_THRESHOLD = 0.3;
const INTEGER_MATERIAL_UNITS = new Set(["件", "颗", "个", "条", "粒", "枚", "PCS", "pc", "pcs"]);

const MATERIAL_STOCK_STATUS_LABEL: Record<MaterialStockStatusCode, PreOutboundOrder["stockStatus"]> = {
  STOCK_SUFFICIENT: "库存充足",
  STOCK_PARTIAL_SUFFICIENT: "库存部分充足",
  STOCK_INSUFFICIENT: "库存不足",
};

const roundMaterialQtyByUnit = (qty: number, unit?: string) => {
  const normalizedQty = Math.max(0, Number.isFinite(qty) ? qty : 0);
  if (unit && INTEGER_MATERIAL_UNITS.has(unit)) return Math.floor(normalizedQty);
  return Math.floor(normalizedQty * 1000) / 1000;
};

const getAvailableStockQuantity = (
  stock?: Pick<StockRealtimeItem, "spotStock" | "pendingShipmentQuantity" | "preSaleOrderOccupiedQuantity" | "spotOrderOccupiedQuantity">,
) =>
  Math.max(
    0,
    (stock?.spotStock || 0) -
      (stock?.pendingShipmentQuantity || 0) -
      (stock?.preSaleOrderOccupiedQuantity || 0) -
      (stock?.spotOrderOccupiedQuantity || 0),
  );

const isMaterialPickingPdaVisible = (status?: MaterialPickingStatusCode) =>
  status === "WAIT_PICKING" || status === "PICKING";

const calculateMaterialStockCheck = (
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
      fulfillRate >= 1
        ? "SUFFICIENT"
        : fulfillRate >= MATERIAL_STOCK_PARTIAL_THRESHOLD
          ? "PARTIAL_SUFFICIENT"
          : "INSUFFICIENT";

    return {
      id: product.id,
      sku: product.sku,
      materialName: product.materialName || matchedStock?.productName,
      isRequired,
      requiredQty,
      availableStock,
      fulfillRate,
      suggestedPickingQuantity: roundMaterialQtyByUnit(
        Math.min(requiredQty, requiredQty * cappedRate, availableStock),
        product.unit,
      ),
      stockJudgement,
      unit: product.unit,
    };
  });

  const requiredLines = lines.filter((line) => line.isRequired);
  const available_ratio =
    requiredLines.length > 0 ? Math.min(...requiredLines.map((line) => line.fulfillRate)) : 1;
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
    factory_confirm_status:
      stock_status === "STOCK_PARTIAL_SUFFICIENT" ? "PENDING_CONFIRM" : "NOT_REQUIRED",
    picking_status:
      stock_status === "STOCK_SUFFICIENT"
        ? "WAIT_PICKING"
        : stock_status === "STOCK_PARTIAL_SUFFICIENT"
          ? "DRAFT"
          : "CANCELLED",
    requisition_status:
      stock_status === "STOCK_INSUFFICIENT" ? "STOCK_INSUFFICIENT" : "STOCK_CHECKED",
    available_ratio,
    need_factory_confirm: stock_status === "STOCK_PARTIAL_SUFFICIENT",
    lines,
  };
};

const applyMaterialStockCheckToOrder = (
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
          pickedQuantity:
            result.stock_status === "STOCK_PARTIAL_SUFFICIENT" ? 0 : product.pickedQuantity,
          reviewedQuantity:
            result.stock_status === "STOCK_PARTIAL_SUFFICIENT" ? 0 : product.reviewedQuantity,
        }
      : product;
  });
  const pickedQuantity = productItems.reduce(
    (sum, product) => sum + Math.max(0, product.pickedQuantity || 0),
    0,
  );
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
    reviewedQuantity:
      result.stock_status === "STOCK_PARTIAL_SUFFICIENT" ? pickedQuantity : order.reviewedQuantity,
    stockStatus: result.stockStatus,
    stock_status: result.stock_status,
    factory_confirm_status: result.factory_confirm_status,
    picking_status: result.picking_status,
    requisition_status: result.requisition_status,
    available_ratio: result.available_ratio,
    need_factory_confirm: result.need_factory_confirm,
    is_pda_visible: isMaterialPickingPdaVisible(result.picking_status),
    planned_pick_qty: result.lines.reduce(
      (sum, line) => sum + Math.max(0, line.suggestedPickingQuantity || 0),
      0,
    ),
    actual_pick_qty: productItems.reduce(
      (sum, product) => sum + Math.max(0, product.pickedQuantity || 0),
      0,
    ),
    reservation_status:
      result.stock_status === "STOCK_PARTIAL_SUFFICIENT"
        ? "DRAFT_RESERVED"
        : result.stock_status === "STOCK_SUFFICIENT"
          ? "RESERVED"
          : "NONE",
    factoryCallbackPayload,
  };
};

// ── Status normalizer ────────────────────────────────────────────────────────

const normalizePreOutboundStatus = (order: PreOutboundOrder): PreOutboundOrder => {
  const totalPlannedQuantity = order.productItems.reduce(
    (sum, product) => sum + Math.max(0, product.outboundQuantity || 0),
    0,
  );
  const totalPickedQuantity = order.productItems.reduce(
    (sum, product) => sum + Math.max(0, product.pickedQuantity || 0),
    0,
  );
  const totalShippedQuantity = order.productItems.reduce(
    (sum, product) => sum + Math.max(0, product.shippedQuantity || 0),
    0,
  );
  const rawStatus = order.status as string;
  const status: PreOutboundStatus =
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

// ── Wave helpers ─────────────────────────────────────────────────────────────

const isMultiItemBasketOrder = (order: PreOutboundOrder) => {
  const effectiveItems = order.productItems.filter(
    (product) => Math.max(0, product.outboundQuantity - (product.shippedQuantity || 0)) > 0,
  );
  const effectiveSkuCount = new Set(effectiveItems.map((product) => product.sku)).size;
  const effectiveQty = effectiveItems.reduce(
    (sum, product) => sum + Math.max(0, product.outboundQuantity - (product.shippedQuantity || 0)),
    0,
  );
  return effectiveSkuCount > 1 || effectiveQty > 1;
};

// ===========================================================================
// 1. returnOrderSeed
// ===========================================================================

export const returnOrderSeed: ReturnOrder[] = Array.from({ length: 24 }, (_, index) => {
  const warehouses = ["成衣仓库", "雅加达中心仓", "万隆成品仓", "泗水电商仓"];
  const relatedPrefixes = ["XS", "TH", "YS"];
  const owner = subjectSeed[index % subjectSeed.length]?.name || "系统货主";
  const status = RETURN_STATUS_FLOW[index % RETURN_STATUS_FLOW.length];
  const qualityResult: ReturnQualityResult | null =
    status === "待收货" || status === "待质检"
      ? null
      : index % 3 === 0
        ? "可售"
        : index % 3 === 1
          ? "瑕疵"
          : "报废";
  const quantity = 1;
  const receivedQuantity = status === "待收货" ? 0 : 1;
  const qualityCheckedCompleteQuantity =
    status === "待收货" || status === "待质检" || qualityResult !== "可售" ? 0 : receivedQuantity;
  const qualityCheckedDefectQuantity =
    status === "待收货" || status === "待质检" || qualityResult !== "瑕疵" ? 0 : receivedQuantity;
  const qualityCheckedScrapQuantity =
    status === "待收货" || status === "待质检" || qualityResult !== "报废" ? 0 : receivedQuantity;
  const putawayQuantity =
    status === "待收货" || status === "待质检" || status === "待入库" || status === "待上架"
      ? 0
      : qualityResult === "报废"
        ? 0
        : quantity;
  const relatedOrderNo = `${relatedPrefixes[index % relatedPrefixes.length]}-202604${String((index % 20) + 1).padStart(2, "0")}-${String(6000 + index).padStart(4, "0")}`;
  const createdAt = `2026-04-${String((index % 20) + 1).padStart(2, "0")} ${String(8 + (index % 8)).padStart(2, "0")}:20`;
  return {
    id: `RTN-${String(index + 1).padStart(4, "0")}`,
    returnOrderNo: `RTN202604${String((index % 20) + 1).padStart(2, "0")}${String(100 + index).padStart(3, "0")}`,
    qualityOrderNo: `RQC202604${String((index % 20) + 1).padStart(2, "0")}${String(100 + index).padStart(3, "0")}`,
    inboundOrderNo: `RIN202604${String((index % 20) + 1).padStart(2, "0")}${String(100 + index).padStart(3, "0")}`,
    putawayOrderNo: `RPUT202604${String((index % 20) + 1).padStart(2, "0")}${String(100 + index).padStart(3, "0")}`,
    relatedOrderNo,
    warehouseName: warehouses[index % warehouses.length],
    ownerName: owner,
    spu: `SPU-RT-${String(3000 + index).padStart(4, "0")}`,
    sku: `SKU-RT-${String(50000 + index).padStart(5, "0")}`,
    quantity,
    receivedQuantity,
    qualityResult,
    hasStain: qualityResult === "瑕疵" ? index % 2 === 0 : false,
    hasDamage: qualityResult === "瑕疵" ? index % 3 === 0 : false,
    hasWearTrace: qualityResult === "瑕疵" ? index % 4 === 0 : false,
    tagIntact: qualityResult !== "报废",
    qualityInspector: status === "待收货" || status === "待质检" ? "" : "VM",
    qualityCheckedCompleteQuantity,
    qualityCheckedDefectQuantity,
    qualityCheckedScrapQuantity,
    putawayQuantity,
    defectLocation: qualityResult === "瑕疵" ? `DEF-${String((index % 8) + 1).padStart(2, "0")}` : "",
    putawayLocation:
      qualityResult === "可售"
        ? `A-${String((index % 12) + 1).padStart(2, "0")}`
        : qualityResult === "瑕疵"
          ? `B-${String((index % 12) + 1).padStart(2, "0")}`
          : "",
    operatorName: "",
    status,
    createdAt,
    updatedAt: createdAt,
  };
}).flatMap((item, index) => {
  const multiSpuSkuOrderLinePlan: Record<number, number> = {
    0: 6,
    5: 5,
    10: 6,
    15: 5,
    20: 7,
  };
  const lineCount = multiSpuSkuOrderLinePlan[index];
  if (!lineCount) {
    return [item];
  }

  return Array.from({ length: lineCount }, (_, lineIndex) => {
    const lineNo = lineIndex + 1;
    const serial = index * 10 + lineNo;
    const quantity = 1 + (serial % 3);
    const receivedQuantity = item.status === "待收货" ? 0 : quantity;
    const qualityCheckedCompleteQuantity =
      item.status === "待收货" || item.status === "待质检" || item.qualityResult !== "可售"
        ? 0
        : receivedQuantity;
    const qualityCheckedDefectQuantity =
      item.status === "待收货" || item.status === "待质检" || item.qualityResult !== "瑕疵"
        ? 0
        : receivedQuantity;
    const qualityCheckedScrapQuantity =
      item.status === "待收货" || item.status === "待质检" || item.qualityResult !== "报废"
        ? 0
        : receivedQuantity;
    const putawayQuantity =
      item.status === "待收货" || item.status === "待质检" || item.status === "待入库" || item.status === "待上架"
        ? 0
        : item.qualityResult === "报废"
          ? 0
          : quantity;
    return {
      ...item,
      id: `${item.id}-L${lineNo}`,
      spu: `SPU-RT-${String(7000 + serial).padStart(4, "0")}`,
      sku: `SKU-RT-${String(90000 + serial).padStart(5, "0")}`,
      quantity,
      receivedQuantity,
      qualityCheckedCompleteQuantity,
      qualityCheckedDefectQuantity,
      qualityCheckedScrapQuantity,
      putawayQuantity,
    };
  });
});

// ===========================================================================
// 2. preOutboundAutoSeed
// ===========================================================================

export const preOutboundAutoSeed: PreOutboundOrder[] = Array.from({ length: 24 }, (_, index) => {
  const receivingUnits = ["Jakarta Live Store", "Bandung Retail Hub", "Surabaya Distribution", "Batam Partner DC"];
  const orderPrefix = ["XS", "TH", "DB", "YS"];
  const courierCodes = ["JNE", "JNT", "SICEPAT", "ANTERAJA"] as const;
  const courierCode = courierCodes[index % courierCodes.length];
  const seedStatus = (["待处理", "待处理", "待拣货", "待处理", "待拣货", "已取消"] as const)[index % 6];

  const primaryStock = stockRealtimeSeed[index % stockRealtimeSeed.length];
  const sameWarehouseStocks = stockRealtimeSeed.filter((item) => item.warehouseName === primaryStock.warehouseName);
  const secondaryStock = sameWarehouseStocks[(index + 1) % sameWarehouseStocks.length];
  const selectedStocks =
    secondaryStock && secondaryStock.sku !== primaryStock.sku && index % 2 === 0
      ? [primaryStock, secondaryStock]
      : index % 5 === 0
        ? [primaryStock]
        : [primaryStock];

  const productItems: PreOutboundOrder["productItems"] = selectedStocks.map((stock, stockIndex) => {
    const baseSellable = Math.max(0, stock.spotStock + stock.transitStock - stock.pendingShipmentQuantity);
    const isSingleItem = selectedStocks.length === 1 && index % 5 === 0;
    const outbound = isSingleItem
      ? 1
      : Math.max(4, Math.min(24, Math.floor(baseSellable * 0.25) + (stockIndex % 2 === 0 ? 0 : 2)));
    const pickedQuantity = seedStatus === "待拣货" ? 0 : outbound;
    const shippedQuantity = 0;
    return {
      id: `POI-${index + 1}-${stockIndex + 1}`,
      spu: stock.spu,
      sku: stock.sku,
      productStatus: "成品",
      outboundQuantity: outbound,
      shippedQuantity,
      pickedQuantity,
      reviewedQuantity: 0,
      allocatedLocation:
        stockIndex === 0
          ? `${stock.warehouseName}/拣货区/A-${(index % 10) + 1}`
          : undefined,
    };
  });

  const outboundQuantity = productItems.reduce((sum, item) => sum + item.outboundQuantity, 0);
  const shippedQuantity = productItems.reduce((sum, item) => sum + item.shippedQuantity, 0);
  const reviewedQuantity = productItems.reduce((sum, item) => sum + item.reviewedQuantity, 0);
  const trackingNo =
    courierCode === "JNE"
      ? `JNE${String(930500000000 + index * 131).padStart(12, "0")}`
      : courierCode === "JNT"
        ? `JP${String(7100000000 + index * 89).padStart(10, "0")}`
        : courierCode === "SICEPAT"
          ? `SICEPAT${String(59000000 + index * 21).padStart(8, "0")}`
          : `AJA${String(650000000 + index * 47).padStart(9, "0")}`;
  const relatedOrderNo = `${orderPrefix[index % orderPrefix.length]}-202604${String((index % 18) + 1).padStart(2, "0")}-${String(9600 + index).padStart(4, "0")}`;
  const outboundType = getOutboundTypeByRelatedOrderNo(relatedOrderNo);

  const skuKinds = new Set(selectedStocks.map((stock) => stock.sku)).size;
  const totalQty = selectedStocks.reduce((sum, stock) => sum + (stock.spotStock + stock.transitStock), 0);
  const fulfillmentMode: FulfillmentMode =
    skuKinds === 1 && selectedStocks.length === 1 && productItems[0].outboundQuantity === 1
      ? "SINGLE_SCAN_SHIP"
      : skuKinds > 1 || totalQty > 10
        ? "STANDARD_REVIEW_SHIP"
        : "STANDARD_SHIP";

  return {
    id: `PO-${String(index + 1).padStart(4, "0")}`,
    outboundOrderNo: `YCK-202604${String((index % 20) + 1).padStart(2, "0")}-${String(1000 + index).padStart(4, "0")}`,
    reviewOrderNo: `FH-202604${String((index % 20) + 1).padStart(2, "0")}-${String(7000 + index).padStart(4, "0")}`,
    pickOrderNo: `JHD-202604${String((index % 20) + 1).padStart(2, "0")}-${String(3000 + index).padStart(4, "0")}`,
    relatedOrderNo,
    outboundType,
    trackingNo,
    outboundWarehouse: primaryStock.warehouseName,
    productItems,
    receivingUnit: receivingUnits[index % receivingUnits.length],
    outboundQuantity,
    shippedQuantity,
    reviewedQuantity,
    waybillPrintCount: 0,
    ownerName: subjectSeed[index % subjectSeed.length].name,
    operatorName: "",
    stockStatus: "库存充足",
    status: seedStatus,
    outboundOrderStatus: seedStatus === "已取消" ? "已取消" : "待复核",
    orderTime: `2026-04-${String(1 + (index % 25)).padStart(2, "0")} ${String(9 + (index % 10)).padStart(2, "0")}:10`,
    pickTime:
      seedStatus === "待拣货"
        ? undefined
        : `2026-04-${String(1 + (index % 25)).padStart(2, "0")} ${String(11 + (index % 8)).padStart(2, "0")}:20`,
    printTime: undefined,
    fulfillmentMode,
    needReview: fulfillmentMode === "STANDARD_REVIEW_SHIP",
    stockDeducted: false,
    stockDeductedTime: undefined,
    stockDeductedSource: undefined,
  };
});

// ===========================================================================
// 3. preOutboundOutboundListSeed
// ===========================================================================

export const preOutboundOutboundListSeed: PreOutboundOrder[] = (() => {
  const receivingUnits = ["Jakarta Live Store", "Bandung Retail Hub", "Surabaya Distribution", "Batam Partner DC"];
  const orderPrefix = ["XS", "TH", "DB", "YS"];

  // 前4条明确为单件快发订单
  const singleItemOrders: PreOutboundOrder[] = [
    {
      id: "PO-OUT-0001",
      outboundOrderNo: "YCK-OUT-20260427-2001",
      reviewOrderNo: "FH-OUT-20260427-9001",
      pickOrderNo: "JHD-OUT-20260427-5001",
      relatedOrderNo: "XS-OUT-20260427-5201",
      outboundType: "销售出库",
      trackingNo: "OUTWB88000001",
      outboundWarehouse: stockRealtimeSeed[0]?.warehouseName || "Jakarta Central",
      productItems: [{
        id: "POI-OUT-0001-1",
        spu: "SPU-GC-1001",
        sku: "SKU-GC-20001",
        productStatus: "成品",
        outboundQuantity: 1,
        shippedQuantity: 0,
        pickedQuantity: 1,
        reviewedQuantity: 0,
        allocatedLocation: `${stockRealtimeSeed[0]?.warehouseName || "Jakarta Central"}/拣货区/A-1`,
      }],
      receivingUnit: receivingUnits[0],
      outboundQuantity: 1,
      shippedQuantity: 0,
      reviewedQuantity: 0,
      waybillPrintCount: 0,
      ownerName: subjectSeed[0]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-04-27 08:30",
      pickTime: "2026-04-27 10:10",
      printTime: undefined,
      fulfillmentMode: "SINGLE_SCAN_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-OUT-0002",
      outboundOrderNo: "YCK-OUT-20260427-2002",
      reviewOrderNo: "FH-OUT-20260427-9002",
      pickOrderNo: "JHD-OUT-20260427-5002",
      relatedOrderNo: "TH-OUT-20260427-5202",
      outboundType: "销售出库",
      trackingNo: "OUTWB88000002",
      outboundWarehouse: stockRealtimeSeed[1]?.warehouseName || "Jakarta Central",
      productItems: [{
        id: "POI-OUT-0002-1",
        spu: "SPU-GC-1002",
        sku: "SKU-GC-20002",
        productStatus: "成品",
        outboundQuantity: 1,
        shippedQuantity: 0,
        pickedQuantity: 1,
        reviewedQuantity: 0,
        allocatedLocation: `${stockRealtimeSeed[1]?.warehouseName || "Jakarta Central"}/拣货区/A-2`,
      }],
      receivingUnit: receivingUnits[1],
      outboundQuantity: 1,
      shippedQuantity: 0,
      reviewedQuantity: 0,
      waybillPrintCount: 0,
      ownerName: subjectSeed[1]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "拣货中",
      outboundOrderStatus: "复核中",
      orderTime: "2026-04-27 09:15",
      pickTime: "2026-04-27 10:20",
      printTime: undefined,
      fulfillmentMode: "SINGLE_SCAN_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-OUT-0003",
      outboundOrderNo: "YCK-OUT-20260427-2003",
      reviewOrderNo: "FH-OUT-20260427-9003",
      pickOrderNo: "JHD-OUT-20260427-5003",
      relatedOrderNo: "DB-OUT-20260427-5203",
      outboundType: "销售出库",
      trackingNo: "OUTWB88000003",
      outboundWarehouse: stockRealtimeSeed[2]?.warehouseName || "Jakarta Central",
      productItems: [{
        id: "POI-OUT-0003-1",
        spu: "SPU-GC-1003",
        sku: "SKU-GC-20003",
        productStatus: "成品",
        outboundQuantity: 1,
        shippedQuantity: 0,
        pickedQuantity: 1,
        reviewedQuantity: 1,
        allocatedLocation: `${stockRealtimeSeed[2]?.warehouseName || "Jakarta Central"}/拣货区/A-3`,
      }],
      receivingUnit: receivingUnits[2],
      outboundQuantity: 1,
      shippedQuantity: 0,
      reviewedQuantity: 1,
      waybillPrintCount: 0,
      ownerName: subjectSeed[2]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "待出库",
      outboundOrderStatus: "待出库",
      orderTime: "2026-04-27 11:30",
      pickTime: "2026-04-27 12:00",
      printTime: undefined,
      fulfillmentMode: "SINGLE_SCAN_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-OUT-0004",
      outboundOrderNo: "YCK-OUT-20260427-2004",
      reviewOrderNo: "FH-OUT-20260427-9004",
      pickOrderNo: "JHD-OUT-20260427-5004",
      relatedOrderNo: "YS-OUT-20260427-5204",
      outboundType: "销售出库",
      trackingNo: "OUTWB88000004",
      outboundWarehouse: stockRealtimeSeed[3]?.warehouseName || "Jakarta Central",
      productItems: [{
        id: "POI-OUT-0004-1",
        spu: "SPU-GC-1004",
        sku: "SKU-GC-20004",
        productStatus: "成品",
        outboundQuantity: 1,
        shippedQuantity: 0,
        pickedQuantity: 1,
        reviewedQuantity: 1,
        allocatedLocation: `${stockRealtimeSeed[3]?.warehouseName || "Jakarta Central"}/拣货区/A-4`,
      }],
      receivingUnit: receivingUnits[3],
      outboundQuantity: 1,
      shippedQuantity: 0,
      reviewedQuantity: 1,
      waybillPrintCount: 1,
      ownerName: subjectSeed[3]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "已出库",
      outboundOrderStatus: "已出库",
      orderTime: "2026-04-27 13:00",
      pickTime: "2026-04-27 13:30",
      printTime: "2026-04-27 14:00",
      fulfillmentMode: "SINGLE_SCAN_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: true,
      stockDeductedTime: "2026-04-27 14:00",
      stockDeductedSource: "PDA单件快发",
    },
  ];

  // 剩余8条保持原有随机逻辑
  const remainingOrders: PreOutboundOrder[] = Array.from({ length: 8 }, (_, index) => {
    const adjustedIndex = index + 4;
    const status = (["待出库", "待出库", "待出库", "已出库", "已出库", "待出库", "待出库", "已出库"] as const)[index];
    const primaryStock = stockRealtimeSeed[(adjustedIndex + 6) % stockRealtimeSeed.length];
    const sameWarehouseStocks = stockRealtimeSeed.filter((item) => item.warehouseName === primaryStock.warehouseName);
    const secondaryStock = sameWarehouseStocks[(adjustedIndex + 2) % sameWarehouseStocks.length] || primaryStock;
    const selectedStocks =
      secondaryStock.sku !== primaryStock.sku && index % 2 === 0
        ? [primaryStock, secondaryStock]
        : [primaryStock];

    const productItems: PreOutboundOrder["productItems"] = selectedStocks.map((stock, stockIndex) => {
      const outboundQuantity = Math.max(3, Math.min(18, 6 + ((adjustedIndex + stockIndex) % 8)));
      const pickedQuantity = outboundQuantity;
      const reviewedQuantity = outboundQuantity;
      const shippedQuantity = status === "已出库" ? outboundQuantity : 0;
      return {
        id: `POI-OUT-${adjustedIndex + 1}-${stockIndex + 1}`,
        spu: stock.spu,
        sku: stock.sku,
        productStatus: "成品",
        outboundQuantity,
        shippedQuantity,
        pickedQuantity,
        reviewedQuantity,
        allocatedLocation:
          stockIndex === 0
            ? `${stock.warehouseName}/拣货区/${String.fromCharCode(65 + (adjustedIndex % 10))}-${(adjustedIndex % 20) + 1}`
            : undefined,
      };
    });

    const outboundQuantity = productItems.reduce((sum, item) => sum + item.outboundQuantity, 0);
    const shippedQuantity = productItems.reduce((sum, item) => sum + item.shippedQuantity, 0);
    const reviewedQuantity = productItems.reduce((sum, item) => sum + item.reviewedQuantity, 0);
    const relatedOrderNo = `${orderPrefix[adjustedIndex % orderPrefix.length]}-OUT-202604${String((adjustedIndex % 18) + 1).padStart(2, "0")}-${String(5200 + adjustedIndex).padStart(4, "0")}`;
    const orderDay = 10 + (adjustedIndex % 10);

    const skuKinds = new Set(selectedStocks.map((stock) => stock.sku)).size;
    const totalQty = selectedStocks.reduce((sum, stock) => sum + (stock.spotStock + stock.transitStock), 0);
    const fulfillmentMode: FulfillmentMode =
      skuKinds === 1 && selectedStocks.length === 1 && productItems[0].outboundQuantity === 1
        ? "SINGLE_SCAN_SHIP"
        : skuKinds > 1 || totalQty > 10
          ? "STANDARD_REVIEW_SHIP"
          : "STANDARD_SHIP";

    return {
      id: `PO-OUT-${String(adjustedIndex + 1).padStart(4, "0")}`,
      outboundOrderNo: `YCK-OUT-202604${String(orderDay).padStart(2, "0")}-${String(2000 + adjustedIndex).padStart(4, "0")}`,
      reviewOrderNo: `FH-OUT-202604${String(orderDay).padStart(2, "0")}-${String(9000 + adjustedIndex).padStart(4, "0")}`,
      pickOrderNo: `JHD-OUT-202604${String(orderDay).padStart(2, "0")}-${String(5000 + adjustedIndex).padStart(4, "0")}`,
      relatedOrderNo,
      outboundType: getOutboundTypeByRelatedOrderNo(relatedOrderNo),
      trackingNo: `OUTWB${String(88000000 + adjustedIndex).padStart(8, "0")}`,
      outboundWarehouse: primaryStock.warehouseName,
      productItems,
      receivingUnit: receivingUnits[adjustedIndex % receivingUnits.length],
      outboundQuantity,
      shippedQuantity,
      reviewedQuantity,
      waybillPrintCount: status === "已出库" ? 1 : 0,
      ownerName: subjectSeed[(adjustedIndex + 2) % subjectSeed.length].name,
      operatorName: "",
      stockStatus: "库存充足",
      status,
      outboundOrderStatus: status,
      orderTime: `2026-04-${String(orderDay).padStart(2, "0")} ${String(8 + (adjustedIndex % 4)).padStart(2, "0")}:30`,
      pickTime: `2026-04-${String(orderDay).padStart(2, "0")} ${String(10 + (adjustedIndex % 4)).padStart(2, "0")}:10`,
      printTime:
        status === "已出库"
          ? `2026-04-${String(orderDay).padStart(2, "0")} ${String(14 + (adjustedIndex % 3)).padStart(2, "0")}:20`
          : undefined,
      fulfillmentMode,
      needReview: fulfillmentMode === "STANDARD_REVIEW_SHIP",
      stockDeducted: status === "已出库",
      stockDeductedTime:
        status === "已出库"
          ? `2026-04-${String(orderDay).padStart(2, "0")} ${String(14 + (adjustedIndex % 3)).padStart(2, "0")}:20`
          : undefined,
      stockDeductedSource: status === "已出库" ? "标准流程" : undefined,
    };
  });

  return [...singleItemOrders, ...remainingOrders];
})();

// ===========================================================================
// 4. preOutboundTestSeed
// ===========================================================================

export const preOutboundTestSeed: PreOutboundOrder[] = (() => {
  const fallbackStock = stockRealtimeSeed[0];
  if (!fallbackStock) return [];

  const testWarehouseName = fallbackStock.warehouseName;
  const warehouseStocks = stockRealtimeSeed.filter((item) => item.warehouseName === testWarehouseName);
  const skuA = warehouseStocks[0] || fallbackStock;
  const skuB = warehouseStocks[1] || warehouseStocks[0] || fallbackStock;
  const skuC = warehouseStocks[2] || warehouseStocks[1] || warehouseStocks[0] || fallbackStock;

  const makeLine = (
    orderNo: string,
    index: number,
    stock: StockRealtimeItem,
    quantity: number,
  ): PreOutboundOrder["productItems"][number] => ({
    id: `POI-TEST-${orderNo}-${index + 1}`,
    spu: stock.spu,
    sku: stock.sku,
    productStatus: "成品",
    outboundQuantity: quantity,
    shippedQuantity: 0,
    pickedQuantity: 0,
    reviewedQuantity: 0,
    allocatedLocation:
      index === 0 ? `${stock.warehouseName}/拣货区/TEST-${orderNo}-${index + 1}` : undefined,
  });

  const makeOrder = (
    suffix: string,
    relatedOrderNo: string,
    orderTime: string,
    lines: PreOutboundOrder["productItems"],
  ): PreOutboundOrder => {
    const outboundQuantity = lines.reduce((sum, line) => sum + line.outboundQuantity, 0);
    const skuKinds = new Set(lines.map((line) => line.sku)).size;
    const fulfillmentMode: FulfillmentMode =
      skuKinds === 1 && lines.length === 1 && lines[0].outboundQuantity === 1
        ? "SINGLE_SCAN_SHIP"
        : skuKinds > 1 || outboundQuantity > 10
          ? "STANDARD_REVIEW_SHIP"
          : "STANDARD_SHIP";

    return {
      id: `PO-TEST-${suffix}`,
      outboundOrderNo: `YCK-TEST-${suffix}`,
      reviewOrderNo: `FH-TEST-${suffix}`,
      pickOrderNo: `JHD-TEST-${suffix}`,
      relatedOrderNo,
      outboundType: getOutboundTypeByRelatedOrderNo(relatedOrderNo),
      trackingNo: `TESTWB${suffix}`,
      outboundWarehouse: testWarehouseName,
      productItems: lines,
      receivingUnit: "Jakarta Live Store",
      outboundQuantity,
      shippedQuantity: 0,
      reviewedQuantity: 0,
      waybillPrintCount: 0,
      ownerName: subjectSeed[0]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "待处理",
      outboundOrderStatus: "待复核",
      orderTime,
      pickTime: undefined,
      printTime: undefined,
      fulfillmentMode,
      needReview: fulfillmentMode === "STANDARD_REVIEW_SHIP",
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    };
  };

  const insufficientQty = Math.max(80, skuA.spotStock + skuA.transitStock + 40);
  const waveBulkOrders: PreOutboundOrder[] = Array.from({ length: 20 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    return makeOrder(
      `WAVE-BULK-${suffix}`,
      `XS-WAVE-BULK-${suffix}`,
      `2026-04-02 09:${String(index).padStart(2, "0")}`,
      [makeLine(`WAVE-BULK-${suffix}`, 0, skuA, 5)],
    );
  });

  return [
    makeOrder("0001", "XS-TEST-0001", "2026-04-01 08:00", [makeLine("0001", 0, skuA, 6)]),
    makeOrder("0002", "TH-TEST-0002", "2026-04-01 08:01", [makeLine("0002", 0, skuA, 7)]),
    makeOrder("0003", "DB-TEST-0003", "2026-04-01 08:02", [makeLine("0003", 0, skuB, 5)]),
    makeOrder("0004", "YS-TEST-0004", "2026-04-01 08:03", [makeLine("0004", 0, skuA, 4), makeLine("0004", 1, skuB, 3)]),
    makeOrder("0005", "XS-TEST-0005", "2026-04-01 08:04", [makeLine("0005", 0, skuA, 3), makeLine("0005", 1, skuC, 2)]),
    makeOrder("0006", "TH-TEST-0006", "2026-04-01 08:05", [makeLine("0006", 0, skuA, insufficientQty)]),
    // 单件快发测试数据（1单1SKU1件）
    makeOrder("SINGLE-001", "XS-SINGLE-001", "2026-04-27 10:00", [makeLine("SINGLE-001", 0, skuA, 1)]),
    makeOrder("SINGLE-002", "TH-SINGLE-002", "2026-04-27 10:01", [makeLine("SINGLE-002", 0, skuB, 1)]),
    makeOrder("SINGLE-003", "DB-SINGLE-003", "2026-04-27 10:02", [makeLine("SINGLE-003", 0, skuC, 1)]),
    // 明确给 SKU-GC-20002 加单件快发订单
    {
      id: "PO-SINGLE-GC20002",
      outboundOrderNo: "YCK-SINGLE-GC20002",
      reviewOrderNo: "FH-SINGLE-GC20002",
      pickOrderNo: "JHD-SINGLE-GC20002",
      relatedOrderNo: "XS-SINGLE-GC20002",
      outboundType: "销售出库",
      trackingNo: "TESTWBSINGLE20002",
      outboundWarehouse: testWarehouseName,
      productItems: [{
        id: "POI-SINGLE-GC20002-1",
        spu: "SPU-GC-1002",
        sku: "SKU-GC-20002",
        productStatus: "成品",
        outboundQuantity: 1,
        shippedQuantity: 0,
        pickedQuantity: 1,
        reviewedQuantity: 0,
        allocatedLocation: `${testWarehouseName}/拣货区/SINGLE-GC20002-1`,
      }],
      receivingUnit: "Jakarta Live Store",
      outboundQuantity: 1,
      shippedQuantity: 0,
      reviewedQuantity: 0,
      waybillPrintCount: 0,
      ownerName: "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-04-27 09:30",
      pickTime: "2026-04-27 09:45",
      printTime: undefined,
      fulfillmentMode: "SINGLE_SCAN_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    ...waveBulkOrders,
  ];
})();

// ===========================================================================
// 5. preOutboundMaterialRequisitionSeed
// ===========================================================================

export const preOutboundMaterialRequisitionSeed: PreOutboundOrder[] = (() => {
  const rawWarehouse = warehouseSeed.find((warehouse) => warehouse.businessType === "FABRIC") || warehouseSeed[0];
  if (!rawWarehouse) return [];
  const rawStocks = stockRealtimeSeed.filter((item) => item.warehouseName === rawWarehouse.name);
  const fallbackStock = rawStocks[0] || stockRealtimeSeed[0];
  if (!fallbackStock) return [];

  const pickStock = (index: number) => rawStocks[index] || fallbackStock;
  const materialStatuses: PreOutboundStatus[] = ["待处理", "待拣货", "拣货中", "待出库", "已出库"];

  const baseOrders = Array.from({ length: 12 }, (_, index) => {
    const status = materialStatuses[index % materialStatuses.length];
    const requisitionMethod: PreOutboundOrder["requisitionMethod"] =
      index % 2 === 0 ? "工厂到仓自提" : "仓库配送到厂";
    const lineCount = index % 3 === 0 ? 3 : index % 2 === 0 ? 2 : 1;
    const selectedStocks = Array.from({ length: lineCount }, (_, stockIndex) => pickStock(index + stockIndex));
    const day = 6 + index;
    const suffix = String(index + 1).padStart(3, "0");
    const productItems = selectedStocks.map((stock, stockIndex) => {
      const lineQuantity = 4 + ((index + stockIndex) % 4) * 2;
      const linePickedQuantity =
        status === "待处理" ? 0 : status === "待拣货" ? Math.max(0, lineQuantity - 2) : lineQuantity;
      const lineReviewedQuantity = linePickedQuantity;
      return {
        id: `POI-MAT-REQ-${suffix}-${stockIndex + 1}`,
        spu: stock.spu,
        sku: stock.sku,
        materialCategory: stock.material_category ?? undefined,
        unit: stock.unit,
        productStatus: stock.material_category ? "半成品" : "成品",
        outboundQuantity: lineQuantity,
        shippedQuantity: 0,
        pickedQuantity: linePickedQuantity,
        reviewedQuantity: lineReviewedQuantity,
        allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-${suffix}-${stockIndex + 1}`,
      };
    });
    const outboundQuantity = productItems.reduce((sum, line) => sum + line.outboundQuantity, 0);
    const pickedQuantity = productItems.reduce((sum, line) => sum + line.pickedQuantity, 0);
    const reviewedQuantity = productItems.reduce((sum, line) => sum + line.reviewedQuantity, 0);
    const shippedQuantity = 0;
    return {
      id: `PO-MAT-REQ-${suffix}`,
      warehouse_id: rawWarehouse.code,
      warehouse_name: rawWarehouse.name,
      warehouse_type: "RAW_MATERIAL" as WarehouseBizType,
      outboundOrderNo: `YCK-MAT-REQ-202605${String(day).padStart(2, "0")}-${suffix}`,
      reviewOrderNo: `FH-MAT-REQ-202605${String(day).padStart(2, "0")}-${suffix}`,
      pickOrderNo: `JHD-MAT-REQ-202605${String(day).padStart(2, "0")}-${suffix}`,
      relatedOrderNo: `YL-MAT-REQ-202605${String(day).padStart(2, "0")}-${suffix}`,
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: `MATWB${String(91000000 + index).padStart(8, "0")}`,
      outboundWarehouse: rawWarehouse.name,
      productItems,
      receivingUnit: "生产车间A",
      requisitionMethod,
      outboundQuantity,
      shippedQuantity,
      reviewedQuantity,
      waybillPrintCount: 0,
      ownerName: subjectSeed[(index + 1) % subjectSeed.length]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status,
      outboundOrderStatus: "待复核",
      orderTime: `2026-05-${String(day).padStart(2, "0")} 09:${String(10 + index).padStart(2, "0")}`,
      pickTime: status === "待处理" ? undefined : `2026-05-${String(day).padStart(2, "0")} 11:20`,
      printTime: undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    };
  });

  const scenarioOrders: PreOutboundOrder[] = [
    {
      id: "PO-MAT-REQ-901",
      warehouse_id: rawWarehouse.code,
      warehouse_name: rawWarehouse.name,
      warehouse_type: "RAW_MATERIAL" as WarehouseBizType,
      outboundOrderNo: "YCK-MAT-REQ-20260521-901",
      reviewOrderNo: "FH-MAT-REQ-20260521-901",
      pickOrderNo: "JHD-MAT-REQ-20260521-901",
      relatedOrderNo: "YL-MAT-REQ-20260521-901",
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: "MATWB91900901",
      outboundWarehouse: rawWarehouse.name,
      productItems: [
        {
          id: "POI-MAT-REQ-901-1",
          spu: pickStock(0).spu,
          sku: pickStock(0).sku,
          materialCategory: pickStock(0).material_category ?? undefined,
          unit: pickStock(0).unit,
          productStatus: pickStock(0).material_category ? "半成品" : "成品",
          outboundQuantity: 6,
          shippedQuantity: 0,
          pickedQuantity: 6,
          reviewedQuantity: 6,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-901-1`,
        },
      ],
      receivingUnit: "生产车间B",
      requisitionMethod: "工厂到仓自提",
      outboundQuantity: 6,
      shippedQuantity: 0,
      reviewedQuantity: 6,
      waybillPrintCount: 0,
      ownerName: subjectSeed[0]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-05-21 10:05",
      pickTime: "2026-05-21 10:40",
      printTime: undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-MAT-REQ-902",
      warehouse_id: rawWarehouse.code,
      warehouse_name: rawWarehouse.name,
      warehouse_type: "RAW_MATERIAL" as WarehouseBizType,
      outboundOrderNo: "YCK-MAT-REQ-20260521-902",
      reviewOrderNo: "FH-MAT-REQ-20260521-902",
      pickOrderNo: "JHD-MAT-REQ-20260521-902",
      relatedOrderNo: "YL-MAT-REQ-20260521-902",
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: "MATWB91900902",
      outboundWarehouse: rawWarehouse.name,
      productItems: [
        {
          id: "POI-MAT-REQ-902-1",
          spu: pickStock(0).spu,
          sku: pickStock(0).sku,
          materialCategory: pickStock(0).material_category ?? undefined,
          unit: pickStock(0).unit,
          productStatus: pickStock(0).material_category ? "半成品" : "成品",
          outboundQuantity: 8,
          shippedQuantity: 0,
          pickedQuantity: 8,
          reviewedQuantity: 8,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-902-1`,
        },
        {
          id: "POI-MAT-REQ-902-2",
          spu: pickStock(4).spu,
          sku: pickStock(4).sku,
          materialCategory: pickStock(4).material_category ?? undefined,
          unit: pickStock(4).unit,
          productStatus: pickStock(4).material_category ? "半成品" : "成品",
          outboundQuantity: 5,
          shippedQuantity: 0,
          pickedQuantity: 5,
          reviewedQuantity: 5,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-902-2`,
        },
      ],
      receivingUnit: "生产车间A",
      requisitionMethod: "仓库配送到厂",
      outboundQuantity: 13,
      shippedQuantity: 0,
      reviewedQuantity: 13,
      waybillPrintCount: 0,
      ownerName: subjectSeed[1]?.name || "平台",
      operatorName: "",
      stockStatus: "库存充足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-05-21 10:20",
      pickTime: "2026-05-21 10:55",
      printTime: undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-MAT-REQ-903",
      warehouse_id: rawWarehouse.code,
      warehouse_name: rawWarehouse.name,
      warehouse_type: "RAW_MATERIAL" as WarehouseBizType,
      outboundOrderNo: "YCK-MAT-REQ-20260521-903",
      reviewOrderNo: "FH-MAT-REQ-20260521-903",
      pickOrderNo: "JHD-MAT-REQ-20260521-903",
      relatedOrderNo: "YL-MAT-REQ-20260521-903",
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: "MATWB91900903",
      outboundWarehouse: rawWarehouse.name,
      productItems: [
        {
          id: "POI-MAT-REQ-903-1",
          spu: pickStock(1).spu,
          sku: pickStock(1).sku,
          materialCategory: pickStock(1).material_category ?? undefined,
          unit: pickStock(1).unit,
          productStatus: pickStock(1).material_category ? "半成品" : "成品",
          outboundQuantity: 8,
          shippedQuantity: 0,
          pickedQuantity: 8,
          reviewedQuantity: 8,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-903-1`,
        },
      ],
      receivingUnit: "生产车间C",
      requisitionMethod: "工厂到仓自提",
      outboundQuantity: 8,
      shippedQuantity: 0,
      reviewedQuantity: 8,
      waybillPrintCount: 0,
      ownerName: subjectSeed[2]?.name || "平台",
      operatorName: "",
      stockStatus: "库存部分充足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-05-21 10:35",
      pickTime: "2026-05-21 11:10",
      printTime: undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-MAT-REQ-904",
      warehouse_id: rawWarehouse.code,
      warehouse_name: rawWarehouse.name,
      warehouse_type: "RAW_MATERIAL" as WarehouseBizType,
      outboundOrderNo: "YCK-MAT-REQ-20260521-904",
      reviewOrderNo: "FH-MAT-REQ-20260521-904",
      pickOrderNo: "JHD-MAT-REQ-20260521-904",
      relatedOrderNo: "YL-MAT-REQ-20260521-904",
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: "MATWB91900904",
      outboundWarehouse: rawWarehouse.name,
      productItems: [
        {
          id: "POI-MAT-REQ-904-1",
          spu: pickStock(3).spu,
          sku: pickStock(3).sku,
          materialCategory: pickStock(3).material_category ?? undefined,
          unit: pickStock(3).unit,
          productStatus: pickStock(3).material_category ? "半成品" : "成品",
          outboundQuantity: 9,
          shippedQuantity: 0,
          pickedQuantity: 9,
          reviewedQuantity: 9,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-904-1`,
        },
        {
          id: "POI-MAT-REQ-904-2",
          spu: pickStock(0).spu,
          sku: pickStock(0).sku,
          materialCategory: pickStock(0).material_category ?? undefined,
          unit: pickStock(0).unit,
          productStatus: pickStock(0).material_category ? "半成品" : "成品",
          outboundQuantity: 4,
          shippedQuantity: 0,
          pickedQuantity: 4,
          reviewedQuantity: 4,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-904-2`,
        },
      ],
      receivingUnit: "生产车间A",
      requisitionMethod: "仓库配送到厂",
      outboundQuantity: 13,
      shippedQuantity: 0,
      reviewedQuantity: 13,
      waybillPrintCount: 0,
      ownerName: subjectSeed[3]?.name || "平台",
      operatorName: "",
      stockStatus: "库存部分充足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-05-21 10:50",
      pickTime: "2026-05-21 11:25",
      printTime: undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-MAT-REQ-905",
      warehouse_id: rawWarehouse.code,
      warehouse_name: rawWarehouse.name,
      warehouse_type: "RAW_MATERIAL" as WarehouseBizType,
      outboundOrderNo: "YCK-MAT-REQ-20260521-905",
      reviewOrderNo: "FH-MAT-REQ-20260521-905",
      pickOrderNo: "JHD-MAT-REQ-20260521-905",
      relatedOrderNo: "YL-MAT-REQ-20260521-905",
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: "MATWB91900905",
      outboundWarehouse: rawWarehouse.name,
      productItems: [
        {
          id: "POI-MAT-REQ-905-1",
          spu: pickStock(2).spu,
          sku: pickStock(2).sku,
          materialCategory: pickStock(2).material_category ?? undefined,
          unit: pickStock(2).unit,
          productStatus: pickStock(2).material_category ? "半成品" : "成品",
          outboundQuantity: 5,
          shippedQuantity: 0,
          pickedQuantity: 5,
          reviewedQuantity: 5,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-905-1`,
        },
      ],
      receivingUnit: "生产车间D",
      requisitionMethod: "工厂到仓自提",
      outboundQuantity: 5,
      shippedQuantity: 0,
      reviewedQuantity: 5,
      waybillPrintCount: 0,
      ownerName: subjectSeed[0]?.name || "平台",
      operatorName: "",
      stockStatus: "库存不足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-05-21 11:05",
      pickTime: "2026-05-21 11:40",
      printTime: undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
    {
      id: "PO-MAT-REQ-906",
      warehouse_id: rawWarehouse.code,
      warehouse_name: rawWarehouse.name,
      warehouse_type: "RAW_MATERIAL" as WarehouseBizType,
      outboundOrderNo: "YCK-MAT-REQ-20260521-906",
      reviewOrderNo: "FH-MAT-REQ-20260521-906",
      pickOrderNo: "JHD-MAT-REQ-20260521-906",
      relatedOrderNo: "YL-MAT-REQ-20260521-906",
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: "MATWB91900906",
      outboundWarehouse: rawWarehouse.name,
      productItems: [
        {
          id: "POI-MAT-REQ-906-1",
          spu: pickStock(2).spu,
          sku: pickStock(2).sku,
          materialCategory: pickStock(2).material_category ?? undefined,
          unit: pickStock(2).unit,
          productStatus: pickStock(2).material_category ? "半成品" : "成品",
          outboundQuantity: 2,
          shippedQuantity: 0,
          pickedQuantity: 2,
          reviewedQuantity: 2,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-906-1`,
        },
        {
          id: "POI-MAT-REQ-906-2",
          spu: pickStock(0).spu,
          sku: pickStock(0).sku,
          materialCategory: pickStock(0).material_category ?? undefined,
          unit: pickStock(0).unit,
          productStatus: pickStock(0).material_category ? "半成品" : "成品",
          outboundQuantity: 3,
          shippedQuantity: 0,
          pickedQuantity: 3,
          reviewedQuantity: 3,
          allocatedLocation: `${rawWarehouse.name}/拣货区/MAT-906-2`,
        },
      ],
      receivingUnit: "生产车间B",
      requisitionMethod: "仓库配送到厂",
      outboundQuantity: 5,
      shippedQuantity: 0,
      reviewedQuantity: 5,
      waybillPrintCount: 0,
      ownerName: subjectSeed[1]?.name || "平台",
      operatorName: "",
      stockStatus: "库存不足",
      status: "待出库",
      outboundOrderStatus: "待复核",
      orderTime: "2026-05-21 11:18",
      pickTime: "2026-05-21 11:52",
      printTime: undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: false,
      stockDeductedTime: undefined,
      stockDeductedSource: undefined,
    },
  ];

  return ([...baseOrders, ...scenarioOrders] as PreOutboundOrder[]).map((order) =>
    applyMaterialStockCheckToOrder(order, stockRealtimeSeed),
  );
})();

// ===========================================================================
// 6. materialCategoryOutboundDemoSeed
// ===========================================================================

export const materialCategoryOutboundDemoSeed: PreOutboundOrder[] = ([
  { category: "FABRIC" as MaterialCategory, warehouseType: "FABRIC" as WarehouseBizType, warehouseName: "中央总仓-面料仓", label: "面料", unit: "米" },
  { category: "ACCESSORY" as MaterialCategory, warehouseType: "ACCESSORY" as WarehouseBizType, warehouseName: "中央总仓-辅料仓", label: "辅料", unit: "颗" },
  { category: "YARN" as MaterialCategory, warehouseType: "YARN" as WarehouseBizType, warehouseName: "中央总仓-纱线仓", label: "纱线", unit: "米" },
  { category: "CONSUMABLE" as MaterialCategory, warehouseType: "CONSUMABLE" as WarehouseBizType, warehouseName: "中央总仓-耗材仓", label: "耗材", unit: "个" },
  { category: "PACKAGING" as MaterialCategory, warehouseType: "PACKAGING" as WarehouseBizType, warehouseName: "中央总仓-包材仓", label: "包材", unit: "个" },
]).flatMap((config, configIndex): PreOutboundOrder[] =>
  ([
    { suffix: "201", status: "待处理" as PreOutboundStatus, pickedRatio: 0, shippedRatio: 0, stockStatus: "库存充足" as const },
    { suffix: "202", status: "拣货中" as PreOutboundStatus, pickedRatio: 0.5, shippedRatio: 0, stockStatus: "库存充足" as const },
    { suffix: "203", status: "待出库" as PreOutboundStatus, pickedRatio: 0.65, shippedRatio: 0, stockStatus: "库存部分充足" as const },
    { suffix: "204", status: "待出库" as PreOutboundStatus, pickedRatio: 1, shippedRatio: 0, stockStatus: "库存充足" as const },
    { suffix: "205", status: "已出库" as PreOutboundStatus, pickedRatio: 1, shippedRatio: 1, stockStatus: "库存充足" as const },
  ]).map((item, itemIndex) => {
    const code = warehouseTypeCodeMap[config.warehouseType];
    const outboundOrderStatus: OutboundOrderStatus =
      item.status === "已出库" ? "已出库" : item.status === "待出库" ? "待出库" : "待复核";
    const day = 20 + itemIndex;
    const quantityA = 4 + configIndex + itemIndex;
    const quantityB = 2 + itemIndex;
    const demoStockStatus = item.stockStatus as PreOutboundOrder["stockStatus"];
    const demoAvailableRatio =
      demoStockStatus === "库存部分充足" ? 0.5 : demoStockStatus === "库存不足" ? 0.1 : 1;
    const lines: PreOutboundOrder["productItems"] = [
      {
        id: `POI-${code}-${item.suffix}-1`,
        spu: `SPU-${code}-${1100 + itemIndex}`,
        sku: `SKU-${code}-${51000 + itemIndex}`,
        materialCategory: config.category,
        unit: config.unit,
        productStatus: "半成品",
        outboundQuantity: quantityA,
        availableStock: Math.floor(quantityA * demoAvailableRatio),
        shippedQuantity: Math.floor(quantityA * item.shippedRatio),
        pickedQuantity: Math.floor(quantityA * item.pickedRatio),
        reviewedQuantity: Math.floor(quantityA * item.pickedRatio),
        allocatedLocation: `${config.warehouseName}/拣货区/${code}-${item.suffix}-1`,
      },
      {
        id: `POI-${code}-${item.suffix}-2`,
        spu: `SPU-${code}-${1200 + itemIndex}`,
        sku: `SKU-${code}-${52000 + itemIndex}`,
        materialCategory: config.category,
        unit: config.unit,
        productStatus: "半成品",
        outboundQuantity: quantityB,
        availableStock: Math.floor(quantityB * demoAvailableRatio),
        shippedQuantity: Math.floor(quantityB * item.shippedRatio),
        pickedQuantity: Math.floor(quantityB * item.pickedRatio),
        reviewedQuantity: Math.floor(quantityB * item.pickedRatio),
        allocatedLocation: `${config.warehouseName}/拣货区/${code}-${item.suffix}-2`,
      },
    ];
    const outboundQuantity = lines.reduce((sum, line) => sum + line.outboundQuantity, 0);
    const shippedQuantity = lines.reduce((sum, line) => sum + line.shippedQuantity, 0);
    const pickedQuantity = lines.reduce((sum, line) => sum + line.pickedQuantity, 0);
    return {
      id: `PO-${code}-${item.suffix}`,
      warehouse_id: `WH-L1-${code}-001`,
      warehouse_name: config.warehouseName,
      warehouse_type: config.warehouseType,
      outboundOrderNo: `YCK-${code}-REQ-202605${day}-${item.suffix}`,
      reviewOrderNo: `FH-${code}-REQ-202605${day}-${item.suffix}`,
      pickOrderNo: `JHD-${code}-REQ-202605${day}-${item.suffix}`,
      relatedOrderNo: `YL-${code}-REQ-202605${day}-${item.suffix}`,
      outbound_type: "MATERIAL_REQUISITION_OUTBOUND" as const,
      outboundType: "原料领料出库" as const,
      trackingNo: `MATWB-${code}-${item.suffix}`,
      outboundWarehouse: config.warehouseName,
      productItems: lines,
      receivingUnit: itemIndex % 2 === 0 ? "生产车间A" : "生产车间B",
      requisitionMethod: itemIndex % 2 === 0 ? "仓库配送到厂" : "工厂到仓自提",
      outboundQuantity,
      shippedQuantity,
      reviewedQuantity: pickedQuantity,
      waybillPrintCount: item.status === "已出库" ? 1 : 0,
      ownerName: subjectSeed[(configIndex + itemIndex) % subjectSeed.length]?.name || "印尼万隆主体",
      operatorName: item.status === "待处理" ? "" : "VM",
      stockStatus: item.stockStatus,
      status: item.status,
      outboundOrderStatus,
      orderTime: `2026-05-${day} ${String(9 + itemIndex).padStart(2, "0")}:10`,
      pickTime:
        pickedQuantity > 0
          ? `2026-05-${day} ${String(11 + itemIndex).padStart(2, "0")}:20`
          : undefined,
      printTime: item.status === "已出库" ? `2026-05-${day} 15:30` : undefined,
      fulfillmentMode: "STANDARD_SHIP" as FulfillmentMode,
      needReview: false,
      stockDeducted: item.status === "已出库",
      stockDeductedTime: item.status === "已出库" ? `2026-05-${day} 15:30` : undefined,
      stockDeductedSource: item.status === "已出库" ? "PDA发货" : undefined,
    };
  }),
).map((order) => applyMaterialStockCheckToOrder(order, stockRealtimeSeed));

// ===========================================================================
// 7. preOutboundSeed (combined)
// ===========================================================================

export const preOutboundSeed: PreOutboundOrder[] = [
  ...materialCategoryOutboundDemoSeed,
  ...preOutboundMaterialRequisitionSeed,
  ...preOutboundTestSeed,
  ...preOutboundAutoSeed,
  ...preOutboundOutboundListSeed,
];

// ===========================================================================
// 8. generatedWaveSeed
// ===========================================================================

export const generatedWaveSeed: GeneratedWaveRecord[] = (() => {
  const candidates = preOutboundSeed.filter((order) => order.status !== "已取消").slice(0, 18);
  const keyOf = (warehouseName: string, sku: string): `${string}__${string}` =>
    `${warehouseName}__${sku}`;
  const availableByWarehouseSku = new Map<string, number>();
  stockRealtimeSeed.forEach((item) => {
    const available = Math.max(0, item.spotStock - item.pendingShipmentQuantity);
    availableByWarehouseSku.set(keyOf(item.warehouseName, item.sku), available);
  });

  const eligibleCandidates: PreOutboundOrder[] = [];
  candidates.forEach((order) => {
    const requiredBySku = new Map<string, number>();
    order.productItems.forEach((product) => {
      const planned = Math.max(0, product.outboundQuantity);
      const shipped = Math.max(0, product.shippedQuantity || 0);
      const required = Math.max(0, planned - shipped);
      if (required <= 0) return;
      requiredBySku.set(product.sku, (requiredBySku.get(product.sku) || 0) + required);
    });

    const insufficient = Array.from(requiredBySku.entries()).some(([sku, required]) => {
      const available = availableByWarehouseSku.get(keyOf(order.outboundWarehouse, sku)) || 0;
      return available < required;
    });
    if (insufficient) return;

    requiredBySku.forEach((required, sku) => {
      const stockKey = keyOf(order.outboundWarehouse, sku);
      const available = availableByWarehouseSku.get(stockKey) || 0;
      availableByWarehouseSku.set(stockKey, Math.max(0, available - required));
    });
    eligibleCandidates.push(order);
  });

  const groups = new Map<string, string[]>();
  eligibleCandidates.forEach((order) => {
    const existing = groups.get(order.outboundWarehouse);
    if (existing) {
      existing.push(order.id);
      return;
    }
    groups.set(order.outboundWarehouse, [order.id]);
  });

  const waves: GeneratedWaveRecord[] = [];
  let sequence = 1;

  Array.from(groups.entries()).forEach(([warehouseName, orderIds]) => {
    for (let i = 0; i < orderIds.length; i += 2) {
      const chunkOrderIds = orderIds.slice(i, i + 2);
      if (chunkOrderIds.length === 0) continue;
      const day = 11 + ((sequence - 1) % 14);
      const chunkOrders = chunkOrderIds
        .map((orderId) => preOutboundSeed.find((order) => order.id === orderId))
        .filter((order): order is PreOutboundOrder => Boolean(order));
      const isBasketWave = chunkOrders.length > 0 && chunkOrders.every(isMultiItemBasketOrder);
      waves.push({
        id: `WV-SEED-${sequence}`,
        waveNo: `WAVE-202604${String(day).padStart(2, "0")}-${String(sequence).padStart(3, "0")}`,
        warehouseName,
        orderIds: chunkOrderIds,
        operatorName: "",
        createdAt: `2026-04-${String(day).padStart(2, "0")} 10:${String((sequence * 7) % 60).padStart(2, "0")}`,
        wave_type: isBasketWave ? "MULTI_ITEM_BASKET" : "SINGLE_SKU",
        basket_enabled: isBasketWave,
        enable_area_group: sequence % 3 === 0,
        picking_area_groups: [],
      });
      sequence += 1;
    }
  });

  const bulkWaveOrderIds = preOutboundSeed
    .filter((order) => order.id.startsWith("PO-TEST-WAVE-BULK-"))
    .map((order) => order.id)
    .slice(0, 20);
  if (bulkWaveOrderIds.length === 20) {
    const bulkWaveOrders = bulkWaveOrderIds
      .map((orderId) => preOutboundSeed.find((order) => order.id === orderId))
      .filter((order): order is PreOutboundOrder => Boolean(order));
    const isBulkBasketWave = bulkWaveOrders.length > 0 && bulkWaveOrders.every(isMultiItemBasketOrder);
    waves.unshift({
      id: "WV-SEED-BULK-20",
      waveNo: "WAVE-20260430-900",
      warehouseName:
        preOutboundSeed.find((order) => order.id === bulkWaveOrderIds[0])?.outboundWarehouse ||
        "成衣仓",
      orderIds: bulkWaveOrderIds,
      operatorName: "",
      createdAt: "2026-04-30 16:20",
      wave_type: isBulkBasketWave ? "MULTI_ITEM_BASKET" : "SINGLE_SKU",
      basket_enabled: isBulkBasketWave,
      enable_area_group: true,
      picking_area_groups: [],
    });
  }

  return waves;
})();

// ===========================================================================
// 8b. preOutboundSeedWithWaveStatus
// ===========================================================================

export const preOutboundSeedWithWaveStatus: PreOutboundOrder[] = (() => {
  const wavedOrderIds = new Set(generatedWaveSeed.flatMap((wave) => wave.orderIds));
  return preOutboundSeed.map((order) => {
    if (wavedOrderIds.has(order.id) && order.status === "待处理") {
      return normalizePreOutboundStatus({
        ...order,
        status: "待拣货",
      });
    }
    return normalizePreOutboundStatus(order);
  });
})();

// ===========================================================================
// 9. pickingBasketSeed
// ===========================================================================

export const pickingBasketSeed: PickingBasket[] = warehouseSeed.flatMap(
  (warehouse, warehouseIndex) =>
    Array.from({ length: 12 }, (_, index) => {
      const basketNo = String(index + 1).padStart(3, "0");
      return {
        basket_code: `${warehouse.code}-BASKET-${basketNo}`,
        basket_qr_code: `BASKET-${basketNo}`,
        basket_name: `${warehouse.name} ${String(index + 1).padStart(2, "0")}号拣货篮`,
        basket_type: (index % 6 === 5 ? "大篮" : "普通篮") as BasketType,
        warehouse_name: warehouse.name,
        status: (warehouseIndex === 0 && index === 11 ? "DISABLED" : "IDLE") as BasketStatus,
        remark: warehouseIndex === 0 && index === 11 ? "备用篮，暂不启用" : "",
      };
    }),
);
