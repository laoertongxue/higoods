// ============================================================================
// Seed Data Generation Utilities
// Pure functions for generating warehouse seeds, stock location rows, stock
// realtime data, stock transfer records, fabric/product images, fabric score
// calculations, and zone drafts.
// Source: App.tsx lines 3417-3459, 3980-4047, 5234-5286, 5465-5510,
//         7518-7581, 7658-7702, 7717-7762
// ============================================================================

import type {
  FabricProductItem,
  FabricScoreItem,
  FabricScoreReason,
  ProductItem,
  StockLocationRow,
  StockRealtimeItem,
  StockTransferRecord,
  Warehouse,
  WarehouseBizType,
  WarehouseZone,
} from "../types";

import { getCurrentDateTime } from "./format";
import { warehouseCodePrefixMap } from "./warehouse-config";

// ── Location / Zone helpers ─────────────────────────────────────────────────

/** Create an array of shelf location codes for a given zone/shelf grid. */
export const createShelfLocations = (zoneName: string, shelfName: string, shelfRowCount: number, shelfColumnCount: number): string[] =>
  Array.from({ length: shelfRowCount }, (_, rowIndex) =>
    Array.from(
      { length: shelfColumnCount },
      (_, columnIndex) => `${zoneName}-${shelfName}-${String(rowIndex + 1).padStart(2, "0")}-${String(columnIndex + 1).padStart(2, "0")}`,
    ),
  ).flat();

/** Create a raw material zone with default shelf configuration. */
export const createRawMaterialZone = (id: string, name: string): WarehouseZone => ({
  id,
  name,
  locations: createShelfLocations(name, "R01", 3, 5),
  shelfEnabled: true,
  shelfName: "R01",
  shelfRowCount: 3,
  shelfColumnCount: 5,
  shelfConfigs: [{ id: `${id}-shelf-r01`, name: "R01", rowCount: 3, columnCount: 5 }],
});

/** Build a fully-qualified zone location code, prepending zone name if missing. */
export const buildZoneLocationCode = (zoneName: string, locationCode: string) => {
  const normalizedZoneName = zoneName.trim();
  const normalizedLocationCode = locationCode.trim();
  if (!normalizedZoneName || !normalizedLocationCode) return "";
  const zonePrefix = `${normalizedZoneName.toLowerCase()}-`;
  if (normalizedLocationCode.toLowerCase().startsWith(zonePrefix)) {
    return normalizedLocationCode;
  }
  return `${normalizedZoneName}-${normalizedLocationCode.replace(/^[-\s]+/, "")}`;
};

/** Create a blank zone draft with default shelf configuration. */
export const makeZoneDraft = (): WarehouseZone => ({
  id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  locations: [""],
  shelfEnabled: false,
  shelfName: "R01",
  shelfRowCount: 2,
  shelfColumnCount: 3,
  shelfConfigs: [
    {
      id: `shelf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "R01",
      rowCount: 2,
      columnCount: 3,
    },
  ],
});

// ── Warehouse seed helper ───────────────────────────────────────────────────

/** Create a warehouse seed object with zones and locations pre-populated. */
export const createWarehouseSeed = (
  businessType: WarehouseBizType,
  name: string,
  sequence: number,
  contact: string,
  city: string,
): Warehouse => {
  const seq = String(sequence).padStart(3, "0");
  const prefix = warehouseCodePrefixMap[businessType];
  const isFinished = businessType === "FINISHED";
  const isTransit = businessType === "TRANSIT";
  return {
    code: `WH-L1-${prefix}-${seq}`,
    name,
    type: "自建",
    businessType,
    ownerIds: ["ZT1001"],
    contact,
    locationCount: isFinished ? 120 : isTransit ? 45 : 105,
    country: "Indonesia",
    timezone: "Asia/Jakarta",
    enabled: true,
    address: `${city} Warehouse Center`,
    manager: contact,
    settlement: "集团内部",
    zones: isFinished
      ? [
          { id: `${prefix}-${seq}-pick`, name: "拣货区", locations: ["拣货区01"] },
          { id: `${prefix}-${seq}-rack`, name: "货架区", locations: ["货架区TK"] },
          createRawMaterialZone(`${prefix}-${seq}-a`, "A区"),
        ]
      : [
          createRawMaterialZone(`${prefix}-${seq}-main`, isTransit ? "中转区" : `${name.replace("中央总仓-", "").replace("仓", "")}区`),
          createRawMaterialZone(`${prefix}-${seq}-temp`, "暂存区"),
          createRawMaterialZone(`${prefix}-${seq}-pick`, "拣货区"),
        ],
  };
};

// ── Image generators ────────────────────────────────────────────────────────

/** Generate an SVG data-URI image for a fabric SPU. */
export const makeFabricImage = (spu: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='12' fill='${color}'/><text x='50%' y='44%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='white' font-family='Arial'>FABRIC</text><text x='50%' y='64%' dominant-baseline='middle' text-anchor='middle' font-size='12' fill='white' font-family='Arial'>${spu}</text></svg>`,
  )}`;

/** Generate an SVG data-URI image for a product SPU. */
export const makeProductImage = (spu: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='12' fill='${color}'/><text x='50%' y='44%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='white' font-family='Arial'>PRODUCT</text><text x='50%' y='64%' dominant-baseline='middle' text-anchor='middle' font-size='11' fill='white' font-family='Arial'>${spu}</text></svg>`,
  )}`;

/** Return the appropriate transit SKU image based on SKU prefix or material name. */
export const getTransitSkuImage = (sku: string, materialName: string) => {
  const imageCode = sku.slice(-7);
  return sku.startsWith("FAB-") || materialName.includes("面料")
    ? makeFabricImage(imageCode, "#2563EB")
    : makeProductImage(imageCode, "#0F766E");
};

// ── Stock location / realtime seed builders ─────────────────────────────────

/** Build initial stock location rows by distributing realtime items across warehouse locations. */
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

/** Build realtime stock seed data by distributing products across enabled warehouses. */
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

/** Build seed stock transfer records from stock location rows. */
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

// ── Fabric product / score helpers ──────────────────────────────────────────

/** Generate fabric product items with computed scores, sales, and bad-review data. */
export const makeFabricProducts = (spu: string, color: string, seed: number): FabricProductItem[] => {
  const base = 14 + (seed % 6) * 3;
  const salesSeed = [920, 1180, 1360, 1590, 1840, 2120, 2480, 2860];
  const productNames = [
    "基础打底长袖衫",
    "圆领轻薄短袖",
    "基础修身内搭",
    "亲肤弹力针织衫",
    "轻暖磨毛打底衫",
    "简约百搭上衣",
    "基础通勤衬衫",
    "日常休闲卫衣",
  ];
  const styleCodes = [
    "36-基础服装-基础打底",
    "42-基础服装-基础T恤",
    "51-基础服装-基础衬衫",
    "63-基础服装-基础卫衣",
    "74-基础服装-基础针织",
    "86-基础服装-基础外套",
    "95-基础服装-基础裤装",
    "108-基础服装-基础裙装",
  ];
  const reasonTemplates = [
    ["起球", "掉色", "缩水", "其他"],
    ["扎肤", "透气性差", "色差", "其他"],
    ["起皱", "易变形", "异味", "其他"],
    ["面料偏薄", "锁边开线", "透色", "其他"],
  ] as const;

  return Array.from({ length: 3 }, (_, index) => {
    const productBadReviewCount = base + index * (2 + (seed % 2));
    const defaultTotalBadReviewCount = productBadReviewCount + 18 + seed * 2 + index * 5;
    const highRatioCase = (seed + index) % 6 === 0 || (seed % 7 === 0 && index === 1);
    const totalBadReviewCount = highRatioCase
      ? productBadReviewCount + Math.max(2, Math.floor(productBadReviewCount * 0.35))
      : defaultTotalBadReviewCount;
    const salesCount = salesSeed[(seed + index) % salesSeed.length] + seed * 37 + index * 96;
    const score = Number((4.8 - (seed % 3) * 0.3 - index * 0.2).toFixed(1));
    const reasons = reasonTemplates[(seed + index) % reasonTemplates.length];
    const first = Math.max(1, Math.floor(productBadReviewCount * 0.35));
    const second = Math.max(1, Math.floor(productBadReviewCount * 0.28));
    const third = Math.max(1, Math.floor(productBadReviewCount * 0.22));
    const fourth = Math.max(1, productBadReviewCount - first - second - third);

    return {
      id: `${spu}-0${index + 1}`,
      image: makeFabricImage(`${spu.slice(-4)}${String.fromCharCode(65 + index)}`, color),
      spu: `${spu}-${String.fromCharCode(65 + index)}`,
      productName: `${productNames[(seed + index) % productNames.length]}${String.fromCharCode(65 + index)}款`,
      styleCode: styleCodes[(seed + index) % styleCodes.length],
      salesCount,
      score,
      totalBadReviewCount,
      badReviewCount: productBadReviewCount,
      reasonCounts: [
        { reason: reasons[0], count: first },
        { reason: reasons[1], count: second },
        { reason: reasons[2], count: third },
        { reason: reasons[3], count: fourth },
      ],
    };
  });
};

/** Get the total bad review count across all details of a fabric score item. */
export const getFabricTotalBadReviewCount = (item: FabricScoreItem) =>
  item.details.reduce((sum, detail) => sum + detail.badReviewCount, 0);

/** Get the related SPU count (number of detail items) for a fabric score item. */
export const getFabricRelatedSpuCount = (item: FabricScoreItem) => item.details.length;

/** Get the total sales count across all details of a fabric score item. */
export const getFabricTotalSalesCount = (item: FabricScoreItem) =>
  item.details.reduce((sum, detail) => sum + detail.salesCount, 0);

/** Get the total bad review count (including related) across all details. */
export const getFabricTotalBadCount = (item: FabricScoreItem) =>
  item.details.reduce((sum, detail) => sum + detail.totalBadReviewCount, 0);

/** Compute per-reason ratio breakdown for a fabric score item. */
export const getFabricReasonRatios = (item: FabricScoreItem): FabricScoreReason[] => {
  const reasonCountMap = new Map<string, number>();
  item.details.forEach((detail) => {
    detail.reasonCounts.forEach((reason) => {
      reasonCountMap.set(reason.reason, (reasonCountMap.get(reason.reason) || 0) + reason.count);
    });
  });

  const total = Array.from(reasonCountMap.values()).reduce((sum, count) => sum + count, 0);

  return Array.from(reasonCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({
      reason: `${reason}：${count}条`,
      ratio: total ? `${((count / total) * 100).toFixed(2)}%` : "0%",
    }));
};
