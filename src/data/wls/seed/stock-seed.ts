import type { Warehouse, ProductItem, StockRealtimeItem, StockLocationRow, StockTransferRecord, StockFlowRecord, StockFlowDocType, StockFlowActionType } from "../types";

import { warehouseSeed, productSeed } from "./shared-seed";
import { getCurrentDateTime } from "../shared/format";

export const buildSeedStockTransferRecords = (rows: StockLocationRow[]): StockTransferRecord[] => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const candidates = rows.filter((row) => row.quantity > 2);
  const seedTasks: StockTransferRecord[] = [];
  const usedPairs = new Set<string>();

  for (const source of candidates) {
    if (seedTasks.length >= 3) break;
    const target = rows.find(
      (item) =>
        item.warehouseName === source.warehouseName &&
        (item.warehouseZone !== source.warehouseZone || item.warehouseLocation !== source.warehouseLocation),
    );
    if (!target) continue;

    const pairKey = `${source.warehouseName}-${source.warehouseZone}-${source.warehouseLocation}-${target.warehouseZone}-${target.warehouseLocation}-${source.sku}`;
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    const quantity = Math.max(1, Math.min(5, Math.floor(source.quantity / 3) || 1));
    const index = seedTasks.length + 1;

    seedTasks.push({
      id: `STR-SEED-${index}`,
      transferNo: `DB-${datePart}-${String(900 + index).padStart(3, "0")}`,
      sourceWarehouse: source.warehouseName,
      sourceZone: source.warehouseZone,
      sourceLocation: source.warehouseLocation,
      targetWarehouse: target.warehouseName,
      targetZone: target.warehouseZone,
      targetLocation: target.warehouseLocation,
      spu: source.spu,
      sku: source.sku,
      quantity,
      lines: [{ spu: source.spu, sku: source.sku, quantity }],
      createdTime: getCurrentDateTime(),
      status: "待执行",
    });
  }

  return seedTasks;
};

export const buildInitialStockLocationRows = (warehouseList: Warehouse[], realtimeItems: StockRealtimeItem[]): StockLocationRow[] => {
  const updatedAt = getCurrentDateTime();
  const locationMap = new Map<string, Array<{ zone: string; location: string }>>();

  warehouseList.forEach((warehouse) => {
    const locations = warehouse.zones.flatMap((zone) =>
      (zone.locations.length > 0 ? zone.locations : ["暂无"]).map((location) => ({ zone: zone.name, location })),
    );
    locationMap.set(warehouse.name, locations.length > 0 ? locations : [{ zone: "暂无", location: "暂无" }]);
  });

  return realtimeItems.flatMap((item, itemIndex) => {
    const warehouseLocations = locationMap.get(item.warehouseName) || [{ zone: "暂无", location: "暂无" }];
    const spotStock = Math.max(0, item.spotStock);
    if (spotStock <= 0) return [];

    const allocationCount = Math.max(1, Math.min(warehouseLocations.length, spotStock >= 60 ? 3 : spotStock >= 20 ? 2 : 1));
    const startIndex = itemIndex % warehouseLocations.length;
    const selectedLocations = Array.from({ length: allocationCount }, (_, index) => warehouseLocations[(startIndex + index) % warehouseLocations.length]);

    const baseQuantity = Math.floor(spotStock / allocationCount);
    const remainder = spotStock % allocationCount;

    return selectedLocations.map((locationItem, locationIndex) => ({
      id: `${item.id}-${locationItem.zone}-${locationItem.location}-${locationIndex}`,
      warehouseName: item.warehouseName,
      warehouseZone: locationItem.zone,
      warehouseLocation: locationItem.location,
      spu: item.spu,
      sku: item.sku,
      unit: item.unit,
      quantity: baseQuantity + (locationIndex < remainder ? 1 : 0),
      updatedAt,
    }));
  });
};

export const buildStockRealtimeSeed = (warehouseList: Warehouse[], productList: ProductItem[]): StockRealtimeItem[] => {
  const realtimeWarehouses = warehouseList.filter((warehouse) => warehouse.enabled);
  const skuPool = productList.slice(0, Math.max(1, Math.min(productList.length, 12)));

  return realtimeWarehouses.flatMap((warehouse, warehouseIndex) => {
    const warehouseBase = Math.max(80, Math.floor(warehouse.locationCount * 2.2));
    return skuPool.map((product, productIndex) => {
      const wave = (warehouseIndex + productIndex) % 7;
      const baseSpotStock = Math.max(
        24,
        Math.floor(warehouseBase / (skuPool.length + 1)) + (productIndex % 4) * 8 + warehouseIndex * 5 + wave * 3,
      );
      const baseTransitStock = Math.max(8, Math.floor(baseSpotStock * 0.35) + (productIndex % 3) * 3);
      const isLastWarehouse = warehouseIndex === realtimeWarehouses.length - 1;
      const isZeroSpotCandidate = productIndex >= Math.max(0, skuPool.length - 2);
      const shouldUseZeroStock = isLastWarehouse && isZeroSpotCandidate;
      const spotStock = shouldUseZeroStock ? 0 : baseSpotStock;
      const transitStock = shouldUseZeroStock ? 0 : baseTransitStock;
      const pendingShipmentQuantity = 0;
      const preSaleOrderOccupiedQuantity = 0;
      const spotOrderOccupiedQuantity = 0;
      const pendingReturnQualityQuantity = 0;
      const defectiveStock = 0;
      const damagedStock = 0;

      return {
        id: `STK-${warehouse.code}-${product.sku}`,
        image: product.image,
        productName: product.productName,
        spu: product.spu,
        sku: product.sku,
        material_category: product.materialCategory,
        unit: product.unit,
        warehouseName: warehouse.name,
        spotStock,
        transitStock,
        pendingShipmentQuantity,
        preSaleOrderOccupiedQuantity,
        spotOrderOccupiedQuantity,
        pendingReturnQualityQuantity,
        defectiveStock,
        damagedStock,
      };
    });
  });
};

export const stockRealtimeSeed: StockRealtimeItem[] = (() => {
  const seed = buildStockRealtimeSeed(warehouseSeed, productSeed);
  const finishedWarehouseName = warehouseSeed.find((warehouse) => warehouse.businessType === "FINISHED")?.name;
  if (finishedWarehouseName) {
    ["SKU-GC-20001", "SKU-GC-20002", "SKU-GC-20003"].forEach((sku) => {
      const matched = seed.find((item) => item.warehouseName === finishedWarehouseName && item.sku === sku);
      if (!matched) return;
      matched.spotStock = Math.max(matched.spotStock, 500);
      matched.transitStock = Math.max(matched.transitStock, 50);
      matched.pendingShipmentQuantity = 0;
      matched.preSaleOrderOccupiedQuantity = 0;
      matched.spotOrderOccupiedQuantity = 0;
    });
  }
  const rawWarehouseName = warehouseSeed.find((warehouse) => warehouse.businessType === "FABRIC")?.name;
  if (!rawWarehouseName) return seed;

  const rawStockItems = seed.filter((item) => item.warehouseName === rawWarehouseName);
  if (rawStockItems[0]) {
    rawStockItems[0].spotStock = Math.max(rawStockItems[0].spotStock, 120);
    rawStockItems[0].transitStock = Math.max(rawStockItems[0].transitStock, 20);
  }
  if (rawStockItems[1]) {
    rawStockItems[1].spotStock = 3;
    rawStockItems[1].transitStock = 0;
  }
  if (rawStockItems[2]) {
    rawStockItems[2].spotStock = 0;
    rawStockItems[2].transitStock = 0;
  }
  if (rawStockItems[3]) {
    rawStockItems[3].spotStock = 6;
    rawStockItems[3].transitStock = 0;
  }
  return seed;
})();

export const stockFlowSeed: StockFlowRecord[] = (() => {
  const fallback = stockRealtimeSeed[0];
  if (!fallback) return [];

  const sampleRows = stockRealtimeSeed.slice(0, 6);
  const warehouseName = fallback.warehouseName;
  const operators = ["Ayu", "Rina", "Bayu", "Dian"];
  const buildMetricTriplets = (
    base: {
      total: number;
      spot: number;
      transit: number;
      pendingReturn: number;
      defective: number;
      damaged: number;
      preSale: number;
      spotOrder: number;
      available: number;
    },
    changes: Partial<{
      total: number;
      spot: number;
      transit: number;
      pendingReturn: number;
      defective: number;
      damaged: number;
      preSale: number;
      spotOrder: number;
      available: number;
    }>,
  ) => {
    const totalChange = changes.total ?? 0;
    const spotChange = changes.spot ?? 0;
    const transitChange = changes.transit ?? 0;
    const pendingReturnChange = changes.pendingReturn ?? 0;
    const defectiveChange = changes.defective ?? 0;
    const damagedChange = changes.damaged ?? 0;
    const preSaleChange = changes.preSale ?? 0;
    const spotOrderChange = changes.spotOrder ?? 0;
    const availableChange = changes.available ?? 0;
    return {
      totalStockChange: totalChange,
      totalStockBefore: base.total,
      totalStockAfter: base.total + totalChange,
      spotStockChange: spotChange,
      spotStockBefore: base.spot,
      spotStockAfter: base.spot + spotChange,
      transitStockChange: transitChange,
      transitStockBefore: base.transit,
      transitStockAfter: base.transit + transitChange,
      pendingReturnQualityChange: pendingReturnChange,
      pendingReturnQualityBefore: base.pendingReturn,
      pendingReturnQualityAfter: base.pendingReturn + pendingReturnChange,
      defectiveStockChange: defectiveChange,
      defectiveStockBefore: base.defective,
      defectiveStockAfter: base.defective + defectiveChange,
      damagedStockChange: damagedChange,
      damagedStockBefore: base.damaged,
      damagedStockAfter: base.damaged + damagedChange,
      preSaleOccupiedChange: preSaleChange,
      preSaleOccupiedBefore: base.preSale,
      preSaleOccupiedAfter: base.preSale + preSaleChange,
      spotOrderOccupiedChange: spotOrderChange,
      spotOrderOccupiedBefore: base.spotOrder,
      spotOrderOccupiedAfter: base.spotOrder + spotOrderChange,
      availableStockChange: availableChange,
      availableStockBefore: base.available,
      availableStockAfter: base.available + availableChange,
    };
  };

  const baseRecords = sampleRows.map((row, index) => {
    const flowType = (["入库", "上架", "库内调拨", "拣货", "出库"] as const)[index % 5];
    const quantity = Math.max(2, Math.min(18, 5 + index * 2));
    const docType: StockFlowDocType =
      flowType === "入库" ? "收货单" : flowType === "上架" ? "上架单" : flowType === "库内调拨" ? "移货单" : flowType === "拣货" ? "拣货单" : "出库单";
    const actionType: StockFlowActionType =
      flowType === "入库"
        ? "收货入库"
        : flowType === "上架"
          ? "上架入库"
          : flowType === "库内调拨"
            ? "移货"
            : flowType === "拣货"
              ? "锁定库存"
              : "销售出库";
    const qtyChange = actionType === "销售出库" || actionType === "锁定库存" ? -quantity : actionType === "移货" ? 0 : quantity;
    const beforeQty = 120 + index * 9;
    const afterQty = beforeQty + qtyChange;
    const totalSnapshot = Math.max(0, afterQty + 30 + (index % 3) * 5);
    const lockedSnapshot = Math.max(0, actionType === "锁定库存" ? 18 + index : 8 + (index % 4) * 2);
    const inTransitSnapshot = Math.max(0, 6 + (index % 3) * 3);
    const availableSnapshot = Math.max(0, totalSnapshot - lockedSnapshot);
    const metricBase = {
      total: totalSnapshot,
      spot: Math.max(0, totalSnapshot - inTransitSnapshot),
      transit: inTransitSnapshot,
      pendingReturn: Math.max(0, 4 + (index % 3) * 2),
      defective: Math.max(0, 10 + (index % 2) * 4),
      damaged: Math.max(0, 2 + (index % 2) * 2),
      preSale: Math.max(0, 12 + (index % 3) * 3),
      spotOrder: Math.max(0, 8 + (index % 2) * 4),
      available: Math.max(0, availableSnapshot),
    };
    const metricChanges =
      actionType === "收货入库"
        ? (() => {
            const transitShift = Math.min(metricBase.transit, quantity);
            return {
              total: 0,
              spot: transitShift,
              transit: -transitShift,
              available: transitShift,
            };
          })()
        : flowType === "上架" || flowType === "库内调拨" || flowType === "拣货"
            ? { total: 0, spot: 0, transit: 0, available: 0 }
          : actionType === "锁定库存"
            ? { preSale: quantity, available: -quantity }
            : actionType === "销售出库"
              ? { total: -quantity, spot: -quantity, preSale: -Math.min(metricBase.preSale, Math.floor(quantity / 2)), spotOrder: -Math.min(metricBase.spotOrder, Math.ceil(quantity / 2)), available: -quantity }
              : { total: quantity, spot: quantity, available: quantity };
    const metricTriplets = buildMetricTriplets(metricBase, metricChanges);
    const businessNo =
      flowType === "入库"
        ? `YRK-SEED-${String(3001 + index).padStart(4, "0")}`
        : flowType === "上架"
          ? `RKD-SEED-${String(3001 + index).padStart(4, "0")}`
          : flowType === "库内调拨"
            ? `YH-SEED-${String(3001 + index).padStart(4, "0")}`
            : flowType === "拣货"
              ? `JHD-SEED-${String(3001 + index).padStart(4, "0")}`
              : `YCK-SEED-${String(3001 + index).padStart(4, "0")}`;
    const sourceLocation =
      flowType === "入库"
        ? `${row.warehouseName}/收货暂存区`
        : flowType === "上架"
          ? `${row.warehouseName}/收货暂存区`
          : flowType === "库内调拨"
            ? `${row.warehouseName}/A区/A-R01-01-01`
            : flowType === "拣货"
              ? `${row.warehouseName}/A区/A-R01-02-01`
              : `${row.warehouseName}/拣货区/拣货区01`;
    const targetLocation =
      flowType === "入库"
        ? `${row.warehouseName}/收货暂存区`
        : flowType === "上架"
          ? `${row.warehouseName}/A区/A-R01-01-01`
          : flowType === "库内调拨"
            ? `${row.warehouseName}/B区/B-R01-01-01`
            : flowType === "拣货"
              ? `${row.warehouseName}/拣货区/拣货区01`
              : `${row.warehouseName}/出库暂存区`;

    return {
      id: `FLOW-SEED-${index + 1}`,
      businessNo,
      flowType,
      docType,
      actionType,
      warehouseName: row.warehouseName,
      sourceWarehouse: row.warehouseName,
      sourceLocation,
      targetWarehouse: row.warehouseName,
      targetLocation,
      spu: row.spu,
      sku: row.sku,
      productName: row.productName,
      quantity,
      qtyChange,
      beforeQty,
      afterQty,
      totalSnapshot,
      availableSnapshot,
      lockedSnapshot,
      inTransitSnapshot,
      ...metricTriplets,
      locationCode: targetLocation.split("/").slice(-1)[0] || "",
      operatorName: operators[index % operators.length],
      operateTime: `2026-04-${String(10 + index).padStart(2, "0")} ${String(9 + (index % 5)).padStart(2, "0")}:1${index}`,
      operator: operators[index % operators.length],
      operationTime: `2026-04-${String(10 + index).padStart(2, "0")} ${String(9 + (index % 5)).padStart(2, "0")}:1${index}`,
      remark:
        flowType === "入库"
          ? "采购入库完成"
          : flowType === "上架"
            ? `上架完成：移出库位 ${sourceLocation}，移入库位 ${targetLocation}，变动数量 ${quantity}`
            : flowType === "库内调拨"
              ? `移货完成：移出库位 ${sourceLocation}，移入库位 ${targetLocation}，变动数量 ${quantity}`
              : flowType === "拣货"
                ? `拣货完成：移出库位 ${sourceLocation}，移入库位 ${targetLocation}，变动数量 ${quantity}`
                : "出库发货扣减",
    } satisfies StockFlowRecord;
  });

  const extraRecordOneMetrics = buildMetricTriplets(
    {
      total: 128,
      spot: 128,
      transit: 0,
      pendingReturn: 12,
      defective: 16,
      damaged: 18,
      preSale: 20,
      spotOrder: 16,
      available: 92,
    },
    { total: 3, spot: 3, pendingReturn: -3, damaged: 3, available: 3 },
  );

  const extraRecordTwoMetrics = buildMetricTriplets(
    {
      total: 106,
      spot: 106,
      transit: 0,
      pendingReturn: 0,
      defective: 14,
      damaged: 0,
      preSale: 14,
      spotOrder: 12,
      available: 80,
    },
    { total: 6, spot: 6, available: 6 },
  );

  const extraRecords: StockFlowRecord[] = [
    {
      id: "FLOW-SEED-EX-01",
      businessNo: "RKD-SEED-SCRAP-0001",
      flowType: "上架",
      docType: "退货单",
      actionType: "退货入库",
      warehouseName,
      sourceWarehouse: warehouseName,
      sourceLocation: `${warehouseName}/退货暂存区`,
      targetWarehouse: warehouseName,
      targetLocation: `${warehouseName}/破损品区/破损品区库位1`,
      spu: fallback.spu,
      sku: fallback.sku,
      productName: fallback.productName,
      quantity: 3,
      qtyChange: 3,
      beforeQty: 98,
      afterQty: 101,
      totalSnapshot: 128,
      availableSnapshot: 108,
      lockedSnapshot: 20,
      inTransitSnapshot: 0,
      ...extraRecordOneMetrics,
      locationCode: "破损品区库位1",
      operatorName: "Ayu",
      operateTime: "2026-04-18 15:20",
      operator: "Ayu",
      operationTime: "2026-04-18 15:20",
      remark: "退货报废上架（入破损库存）",
    },
    {
      id: "FLOW-SEED-EX-02",
      businessNo: "YH-SEED-CYCLE-0001",
      flowType: "库内调拨",
      docType: "盘点单",
      actionType: "盘盈",
      warehouseName,
      sourceWarehouse: warehouseName,
      sourceLocation: `${warehouseName}/B区/B-R01-01-02`,
      targetWarehouse: warehouseName,
      targetLocation: `${warehouseName}/A区/A-R01-02-02`,
      spu: fallback.spu,
      sku: fallback.sku,
      productName: fallback.productName,
      quantity: 6,
      qtyChange: 6,
      beforeQty: 72,
      afterQty: 78,
      totalSnapshot: 106,
      availableSnapshot: 92,
      lockedSnapshot: 14,
      inTransitSnapshot: 0,
      ...extraRecordTwoMetrics,
      locationCode: "A-R01-02-02",
      operatorName: "Bayu",
      operateTime: "2026-04-19 10:45",
      operator: "Bayu",
      operationTime: "2026-04-19 10:45",
      remark: "盘点差异调整补位",
    },
  ];

  return [...extraRecords, ...baseRecords];
})();

