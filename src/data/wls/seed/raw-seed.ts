// ============================================================================
// Raw Material Warehouse Seed Data
// Covers: rawInboundDemoSeed, yarnInboundDemoSeed,
//         materialCategoryInboundDemoSeed, preInboundSeed (combined),
//         fabricScoreSeed
// Source: App.tsx lines 4394-5041, 7518-7639
// ============================================================================

import type {
  PreInboundOrder,
  PreInboundStatus,
  MaterialCategory,
  WarehouseBizType,
  ProductStatus,
  FabricScoreItem,
} from "../types";

import { putawaySeed, subjectSeed, warehouseTypeCodeMap } from "./shared-seed";
import { getPreInboundStatus } from "../shared/filters";
import { getInboundTypeByRelatedOrderNo } from "../shared/barcode";
import { makeFabricImage, makeFabricProducts } from "../shared/seed-utils";

// ---------------------------------------------------------------------------
// rawInboundDemoSeed — 3 hand-crafted raw material inbound orders
// ---------------------------------------------------------------------------

export const rawInboundDemoSeed: PreInboundOrder[] = [
  {
    id: "PI-RAW-0001",
    inboundOrderNo: "YRK-20260512-3001",
    relatedOrderNo: "CG-20260512-9001",
    inboundType: "原料采购入库",
    trackingNo: "JNE930000000901",
    inboundWarehouse: "原料仓",
    productItems: [
      {
        id: "PII-RAW-0001-1",
        spu: "SPU-RAW-1001",
        sku: "SKU-RAW-50001",
        materialCategory: "FABRIC",
        unit: "米",
        package_qty: 3,
        package_unit: "卷",
        base_qty: 275,
        base_unit: "米",
        received_package_qty: 1,
        received_base_qty: 80,
        putaway_package_qty: 0,
        putaway_base_qty: 0,
        pending_putaway_package_qty: 1,
        pending_putaway_base_qty: 80,
        quantity_per_package: 1,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [
          { roll_no: "ROLL001", length: 80, unit: "米", status: "PENDING_PUTAWAY", location_code: "" },
          { roll_no: "ROLL002", length: 95, unit: "米", status: "PENDING_PUTAWAY", location_code: "" },
          { roll_no: "ROLL003", length: 100, unit: "米", status: "PENDING_PUTAWAY", location_code: "" },
        ],
        productStatus: "半成品",
        deliveryQuantity: 275,
        receivedQuantity: 80,
      },
      {
        id: "PII-RAW-0001-2",
        spu: "SPU-RAW-1002",
        sku: "SKU-RAW-50002",
        materialCategory: "ACCESSORY",
        unit: "颗",
        package_qty: 10,
        package_unit: "包",
        base_qty: 5000,
        base_unit: "颗",
        received_package_qty: 8,
        received_base_qty: 4000,
        putaway_package_qty: 4,
        putaway_base_qty: 2000,
        pending_putaway_package_qty: 4,
        pending_putaway_base_qty: 2000,
        quantity_per_package: 500,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [],
        productStatus: "半成品",
        deliveryQuantity: 5000,
        receivedQuantity: 4000,
      },
    ],
    deliveryUnit: "万隆纺织供应链有限公司",
    deliveryQuantity: 5275,
    receivedQuantity: 4080,
    ownerName: "印尼万隆主体",
    operatorName: "系统管理员",
    status: "部分收货",
    shippingTime: "2026-05-12 09:20",
    receivedTime: "2026-05-12 15:30",
    putawayTime: "",
  },
  {
    id: "PI-RAW-0002",
    inboundOrderNo: "YRK-20260512-3002",
    relatedOrderNo: "CG-20260512-9002",
    inboundType: "原料采购入库",
    trackingNo: "SICEPAT58000091",
    inboundWarehouse: "原料仓",
    productItems: [
      {
        id: "PII-RAW-0002-1",
        spu: "SPU-RAW-1011",
        sku: "SKU-RAW-50011",
        materialCategory: "PACKAGING",
        unit: "个",
        package_qty: 20,
        package_unit: "包",
        base_qty: 2000,
        base_unit: "个",
        received_package_qty: 20,
        received_base_qty: 2000,
        putaway_package_qty: 10,
        putaway_base_qty: 1000,
        pending_putaway_package_qty: 10,
        pending_putaway_base_qty: 1000,
        quantity_per_package: 100,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [],
        productStatus: "半成品",
        deliveryQuantity: 2000,
        receivedQuantity: 2000,
      },
      {
        id: "PII-RAW-0002-2",
        spu: "SPU-RAW-1012",
        sku: "SKU-RAW-50012",
        materialCategory: "YARN",
        unit: "kg",
        package_qty: 12,
        package_unit: "袋",
        base_qty: 600,
        base_unit: "kg",
        received_package_qty: 12,
        received_base_qty: 600,
        putaway_package_qty: 0,
        putaway_base_qty: 0,
        pending_putaway_package_qty: 12,
        pending_putaway_base_qty: 600,
        quantity_per_package: 50,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [],
        productStatus: "半成品",
        deliveryQuantity: 600,
        receivedQuantity: 600,
      },
    ],
    deliveryUnit: "泗水针织原料有限公司",
    deliveryQuantity: 2600,
    receivedQuantity: 2600,
    ownerName: "雅加达电商主体",
    operatorName: "仓库主管",
    status: "全部收货",
    shippingTime: "2026-05-12 10:00",
    receivedTime: "2026-05-12 17:10",
    putawayTime: "2026-05-12 18:20",
  },
  {
    id: "PI-RAW-0003",
    inboundOrderNo: "YRK-20260513-3003",
    relatedOrderNo: "CG-20260513-9003",
    inboundType: "原料采购入库",
    trackingNo: "JNT7000009988",
    inboundWarehouse: "原料仓",
    productItems: [
      {
        id: "PII-RAW-0003-1",
        spu: "SPU-RAW-1021",
        sku: "SKU-RAW-50021",
        materialCategory: "CONSUMABLE",
        unit: "个",
        package_qty: 15,
        package_unit: "箱",
        base_qty: 1500,
        base_unit: "个",
        received_package_qty: 0,
        received_base_qty: 0,
        putaway_package_qty: 0,
        putaway_base_qty: 0,
        pending_putaway_package_qty: 0,
        pending_putaway_base_qty: 0,
        quantity_per_package: 100,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [],
        productStatus: "半成品",
        deliveryQuantity: 1500,
        receivedQuantity: 0,
      },
    ],
    deliveryUnit: "巴厘岛辅料中心",
    deliveryQuantity: 1500,
    receivedQuantity: 0,
    ownerName: "印尼万隆主体",
    operatorName: "",
    status: "待收货",
    shippingTime: "2026-05-13 08:30",
    receivedTime: "",
    putawayTime: "",
  },
];

// ---------------------------------------------------------------------------
// yarnInboundDemoSeed — 3 hand-crafted yarn inbound orders
// ---------------------------------------------------------------------------

export const yarnInboundDemoSeed: PreInboundOrder[] = [
  {
    id: "PI-YARN-0001",
    warehouse_id: "WH-L1-YRN-001",
    warehouse_name: "中央总仓-纱线仓",
    warehouse_type: "YARN",
    inbound_type: "MATERIAL_PURCHASE_INBOUND",
    inboundOrderNo: "YRK-YRN-20260528-001",
    relatedOrderNo: "CG-YRN-20260528-001",
    inboundType: "原料采购入库",
    trackingNo: "JNE-YRN-20260528001",
    inboundWarehouse: "中央总仓-纱线仓",
    productItems: [
      {
        id: "PII-YARN-0001-1",
        spu: "SPU-YRN-1001",
        sku: "SKU-YRN-50001",
        materialCategory: "YARN",
        unit: "米",
        package_qty: 8,
        package_unit: "卷",
        base_qty: 1600,
        base_unit: "米",
        received_package_qty: 3,
        received_base_qty: 600,
        putaway_package_qty: 1,
        putaway_base_qty: 200,
        pending_putaway_package_qty: 2,
        pending_putaway_base_qty: 400,
        quantity_per_package: 200,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [
          { roll_no: "YRN-ROLL-001", length: 200, unit: "米", status: "PUTAWAY_DONE", location_code: "YARN-A-01" },
          { roll_no: "YRN-ROLL-002", length: 200, unit: "米", status: "PENDING_PUTAWAY", location_code: "" },
          { roll_no: "YRN-ROLL-003", length: 200, unit: "米", status: "PENDING_PUTAWAY", location_code: "" },
        ],
        productStatus: "半成品",
        deliveryQuantity: 1600,
        receivedQuantity: 600,
      },
      {
        id: "PII-YARN-0001-2",
        spu: "SPU-YRN-1002",
        sku: "SKU-YRN-50002",
        materialCategory: "YARN",
        unit: "米",
        package_qty: 5,
        package_unit: "卷",
        base_qty: 1250,
        base_unit: "米",
        received_package_qty: 0,
        received_base_qty: 0,
        putaway_package_qty: 0,
        putaway_base_qty: 0,
        pending_putaway_package_qty: 0,
        pending_putaway_base_qty: 0,
        quantity_per_package: 250,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [],
        productStatus: "半成品",
        deliveryQuantity: 1250,
        receivedQuantity: 0,
      },
    ],
    deliveryUnit: "万隆纱线供应链有限公司",
    deliveryQuantity: 2850,
    receivedQuantity: 600,
    ownerName: "印尼万隆主体",
    operatorName: "Rina",
    status: "部分收货",
    shippingTime: "2026-05-28 09:20",
    receivedTime: "2026-05-28 14:10",
    putawayTime: "",
  },
  {
    id: "PI-YARN-0002",
    warehouse_id: "WH-L1-YRN-002",
    warehouse_name: "纱线仓-深圳仓01",
    warehouse_type: "YARN",
    inbound_type: "MATERIAL_PURCHASE_INBOUND",
    inboundOrderNo: "YRK-YRN-20260529-002",
    relatedOrderNo: "CG-YRN-20260529-002",
    inboundType: "原料采购入库",
    trackingNo: "JNT-YRN-20260529002",
    inboundWarehouse: "纱线仓-深圳仓01",
    productItems: [
      {
        id: "PII-YARN-0002-1",
        spu: "SPU-YRN-1003",
        sku: "SKU-YRN-50003",
        materialCategory: "YARN",
        unit: "米",
        package_qty: 10,
        package_unit: "卷",
        base_qty: 1800,
        base_unit: "米",
        received_package_qty: 10,
        received_base_qty: 1800,
        putaway_package_qty: 6,
        putaway_base_qty: 1080,
        pending_putaway_package_qty: 4,
        pending_putaway_base_qty: 720,
        quantity_per_package: 180,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [
          { roll_no: "YRN-ROLL-011", length: 180, unit: "米", status: "PUTAWAY_DONE", location_code: "YARN-B-01" },
          { roll_no: "YRN-ROLL-012", length: 180, unit: "米", status: "PENDING_PUTAWAY", location_code: "" },
        ],
        productStatus: "半成品",
        deliveryQuantity: 1800,
        receivedQuantity: 1800,
      },
    ],
    deliveryUnit: "泗水纺纱厂",
    deliveryQuantity: 1800,
    receivedQuantity: 1800,
    ownerName: "印尼万隆主体",
    operatorName: "Dian",
    status: "全部收货",
    shippingTime: "2026-05-29 10:30",
    receivedTime: "2026-05-29 16:40",
    putawayTime: "2026-05-29 18:00",
  },
  {
    id: "PI-YARN-0003",
    warehouse_id: "WH-L1-YRN-003",
    warehouse_name: "纱线仓-武汉仓01",
    warehouse_type: "YARN",
    inbound_type: "MATERIAL_PURCHASE_INBOUND",
    inboundOrderNo: "YRK-YRN-20260530-003",
    relatedOrderNo: "CG-YRN-20260530-003",
    inboundType: "原料采购入库",
    trackingNo: "SICEPAT-YRN-20260530003",
    inboundWarehouse: "纱线仓-武汉仓01",
    productItems: [
      {
        id: "PII-YARN-0003-1",
        spu: "SPU-YRN-1004",
        sku: "SKU-YRN-50004",
        materialCategory: "YARN",
        unit: "米",
        package_qty: 6,
        package_unit: "卷",
        base_qty: 1200,
        base_unit: "米",
        received_package_qty: 0,
        received_base_qty: 0,
        putaway_package_qty: 0,
        putaway_base_qty: 0,
        pending_putaway_package_qty: 0,
        pending_putaway_base_qty: 0,
        quantity_per_package: 200,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: [],
        productStatus: "半成品",
        deliveryQuantity: 1200,
        receivedQuantity: 0,
      },
    ],
    deliveryUnit: "雅加达纱线贸易有限公司",
    deliveryQuantity: 1200,
    receivedQuantity: 0,
    ownerName: "雅加达电商主体",
    operatorName: "",
    status: "待收货",
    shippingTime: "2026-05-30 08:45",
    receivedTime: "",
    putawayTime: "",
  },
];

// ---------------------------------------------------------------------------
// materialCategoryInboundDemoSeed — 4 categories x 3 statuses = 12 orders
// ---------------------------------------------------------------------------

export const materialCategoryInboundDemoSeed: PreInboundOrder[] = [
  {
    category: "FABRIC" as MaterialCategory,
    warehouseType: "FABRIC" as WarehouseBizType,
    warehouseCode: "WH-L1-FAB-001",
    warehouseName: "中央总仓-面料仓",
    label: "面料",
    packageUnit: "卷" as const,
    baseUnit: "米" as const,
    supplier: "万隆面料供应链有限公司",
    basePerPackage: 80,
  },
  {
    category: "ACCESSORY" as MaterialCategory,
    warehouseType: "ACCESSORY" as WarehouseBizType,
    warehouseCode: "WH-L1-TRM-001",
    warehouseName: "中央总仓-辅料仓",
    label: "辅料",
    packageUnit: "包" as const,
    baseUnit: "颗" as const,
    supplier: "雅加达辅料贸易有限公司",
    basePerPackage: 500,
  },
  {
    category: "CONSUMABLE" as MaterialCategory,
    warehouseType: "CONSUMABLE" as WarehouseBizType,
    warehouseCode: "WH-L1-CON-001",
    warehouseName: "中央总仓-耗材仓",
    label: "耗材",
    packageUnit: "箱" as const,
    baseUnit: "个" as const,
    supplier: "泗水耗材供应中心",
    basePerPackage: 120,
  },
  {
    category: "PACKAGING" as MaterialCategory,
    warehouseType: "PACKAGING" as WarehouseBizType,
    warehouseCode: "WH-L1-PKG-001",
    warehouseName: "中央总仓-包材仓",
    label: "包材",
    packageUnit: "包" as const,
    baseUnit: "个" as const,
    supplier: "万隆包装材料有限公司",
    basePerPackage: 200,
  },
].flatMap((config, configIndex): PreInboundOrder[] =>
  ([
    { suffix: "101", packageQty: 12, receivedPackageQty: 0, status: "待收货" as PreInboundStatus, day: 28 },
    { suffix: "102", packageQty: 16, receivedPackageQty: 7, status: "部分收货" as PreInboundStatus, day: 29 },
    { suffix: "103", packageQty: 9, receivedPackageQty: 9, status: "全部收货" as PreInboundStatus, day: 30 },
  ]).map((item, itemIndex) => {
    const baseQty = item.packageQty * config.basePerPackage;
    const receivedBaseQty = item.receivedPackageQty * config.basePerPackage;
    const putawayPackageQty = item.status === "全部收货" ? Math.max(1, Math.floor(item.receivedPackageQty * 0.6)) : 0;
    const putawayBaseQty = putawayPackageQty * config.basePerPackage;
    return {
      id: `PI-${config.category}-${item.suffix}`,
      warehouse_id: config.warehouseCode,
      warehouse_name: config.warehouseName,
      warehouse_type: config.warehouseType,
      inbound_type: "MATERIAL_PURCHASE_INBOUND",
      inboundOrderNo: `YRK-${warehouseTypeCodeMap[config.warehouseType]}-202605${item.day}-${item.suffix}`,
      relatedOrderNo: `CG-${warehouseTypeCodeMap[config.warehouseType]}-202605${item.day}-${item.suffix}`,
      inboundType: "原料采购入库",
      trackingNo: `TRK-${warehouseTypeCodeMap[config.warehouseType]}-202605${item.day}${item.suffix}`,
      inboundWarehouse: config.warehouseName,
      productItems: [
        {
          id: `PII-${config.category}-${item.suffix}-1`,
          spu: `SPU-${warehouseTypeCodeMap[config.warehouseType]}-${1000 + itemIndex}`,
          sku: `SKU-${warehouseTypeCodeMap[config.warehouseType]}-${50000 + itemIndex}`,
          materialCategory: config.category,
          unit: config.baseUnit,
          package_qty: item.packageQty,
          package_unit: config.packageUnit,
          base_qty: baseQty,
          base_unit: config.baseUnit,
          received_package_qty: item.receivedPackageQty,
          received_base_qty: receivedBaseQty,
          putaway_package_qty: putawayPackageQty,
          putaway_base_qty: putawayBaseQty,
          pending_putaway_package_qty: Math.max(0, item.receivedPackageQty - putawayPackageQty),
          pending_putaway_base_qty: Math.max(0, receivedBaseQty - putawayBaseQty),
          quantity_per_package: config.basePerPackage,
          current_package_qty: 0,
          current_base_qty: 0,
          current_putaway_package_qty: 0,
          current_putaway_base_qty: 0,
          target_location_code: "",
          roll_details:
            config.category === "FABRIC" && item.receivedPackageQty > 0
              ? Array.from({ length: Math.min(item.receivedPackageQty, 3) }, (_, rollIndex) => ({
                  roll_no: `FAB-ROLL-${item.suffix}-${rollIndex + 1}`,
                  length: config.basePerPackage,
                  unit: "米" as const,
                  status: rollIndex < putawayPackageQty ? ("PUTAWAY_DONE" as const) : ("PENDING_PUTAWAY" as const),
                  location_code: rollIndex < putawayPackageQty ? "FAB-A-01" : "",
                }))
              : [],
          productStatus: "半成品",
          deliveryQuantity: baseQty,
          receivedQuantity: receivedBaseQty,
        },
      ],
      deliveryUnit: config.supplier,
      deliveryQuantity: baseQty,
      receivedQuantity: receivedBaseQty,
      ownerName: subjectSeed[(configIndex + itemIndex) % subjectSeed.length]?.name || "印尼万隆主体",
      operatorName: item.status === "待收货" ? "" : itemIndex % 2 === 0 ? "Rina" : "Dian",
      status: item.status,
      shippingTime: `2026-05-${item.day} ${String(9 + itemIndex).padStart(2, "0")}:20`,
      receivedTime: item.receivedPackageQty > 0 ? `2026-05-${item.day} ${String(14 + itemIndex).padStart(2, "0")}:10` : "",
      putawayTime: item.status === "全部收货" ? `2026-05-${item.day} 18:00` : "",
    };
  }),
);

// ---------------------------------------------------------------------------
// preInboundSeed — combined: demo seeds + 30 generated orders
// ---------------------------------------------------------------------------

export const preInboundSeed: PreInboundOrder[] = [...rawInboundDemoSeed, ...materialCategoryInboundDemoSeed, ...yarnInboundDemoSeed, ...Array.from({ length: 30 }, (_, index) => {
  const deliveryUnits = [
    "万隆纺织供应链有限公司",
    "雅加达成衣制造厂",
    "泗水针织原料有限公司",
    "巴厘岛辅料中心",
  ];
  const orderPrefix = ["CG", "GC", "DB"];
  const courierCodes = ["JNE", "JNT", "SICEPAT", "ANTERAJA"] as const;
  const courierCode = courierCodes[index % courierCodes.length];
  const spuCount = 1 + (index % 3);
  const productItems: PreInboundOrder["productItems"] = Array.from({ length: spuCount }, (_, spuIndex) => {
    const spuCode = `SPU-PI-${String(1200 + index * 3 + spuIndex).padStart(4, "0")}`;
    const skuCount = 1 + ((index + spuIndex) % 3);
    return Array.from({ length: skuCount }, (_, skuIndex) => {
      const delivery = 30 + ((index + spuIndex + skuIndex) % 6) * 15;
      const receivedBase =
        index % 3 === 0
          ? 0
          : index % 3 === 1
            ? Math.max(1, delivery - (5 + ((spuIndex + skuIndex) % 4) * 3))
            : delivery;
      const materialCategoryPool: MaterialCategory[] = ["FABRIC", "ACCESSORY", "PACKAGING", "YARN"];
      const materialCategory = materialCategoryPool[(index + spuIndex + skuIndex) % materialCategoryPool.length];
      const isFabric = materialCategory === "FABRIC";
      const packageUnit = (isFabric ? "卷" : ["包", "箱", "袋"][(index + skuIndex) % 3]) as "包" | "卷" | "箱" | "袋";
      const baseUnit = (isFabric ? "米" : ["颗", "个", "kg"][(index + spuIndex) % 3]) as "颗" | "米" | "个" | "kg";
      const quantityPerPackage = isFabric ? 1 : 100 + ((index + skuIndex) % 5) * 100;
      const packageQty = isFabric ? Math.max(1, Math.ceil(delivery / 80)) : Math.max(1, Math.ceil(delivery / quantityPerPackage));
      const baseQty = delivery;
      const receivedBaseQty = receivedBase;
      const receivedPackageQty = isFabric
        ? Math.max(0, Math.ceil(receivedBaseQty / 80))
        : Math.max(0, Math.ceil(receivedBaseQty / quantityPerPackage));
      const putawayBaseQty = receivedBaseQty > 0 ? Math.floor(receivedBaseQty * 0.4) : 0;
      const putawayPackageQty = isFabric
        ? Math.min(receivedPackageQty, Math.floor(putawayBaseQty / 80))
        : Math.min(receivedPackageQty, Math.floor(putawayBaseQty / Math.max(1, quantityPerPackage)));
      const pendingPutawayBaseQty = Math.max(0, receivedBaseQty - putawayBaseQty);
      const pendingPutawayPackageQty = Math.max(0, receivedPackageQty - putawayPackageQty);
      const defaultRolls =
        isFabric && receivedBaseQty > 0
          ? [
              {
                roll_no: `ROLL${String(index + 1).padStart(3, "0")}01`,
                length: Math.min(80, receivedBaseQty),
                unit: "米" as const,
                status: putawayBaseQty >= 80 ? ("PUTAWAY_DONE" as const) : ("PENDING_PUTAWAY" as const),
                location_code: putawayBaseQty >= 80 ? "FAB-A-01" : "",
              },
              {
                roll_no: `ROLL${String(index + 1).padStart(3, "0")}02`,
                length: Math.max(0, receivedBaseQty - Math.min(80, receivedBaseQty)),
                unit: "米" as const,
                status: "PENDING_PUTAWAY" as const,
                location_code: "",
              },
            ].filter((item) => item.length > 0)
          : [];
      return {
        id: `PII-${index + 1}-${spuIndex + 1}-${skuIndex + 1}`,
        spu: spuCode,
        sku: `SKU-PI-${String(25000 + index * 10 + spuIndex * 3 + skuIndex).padStart(5, "0")}`,
        materialCategory,
        unit: baseUnit,
        package_qty: packageQty,
        package_unit: packageUnit,
        base_qty: baseQty,
        base_unit: baseUnit,
        received_package_qty: receivedPackageQty,
        received_base_qty: receivedBaseQty,
        putaway_package_qty: putawayPackageQty,
        putaway_base_qty: putawayBaseQty,
        pending_putaway_package_qty: pendingPutawayPackageQty,
        pending_putaway_base_qty: pendingPutawayBaseQty,
        quantity_per_package: quantityPerPackage,
        current_package_qty: 0,
        current_base_qty: 0,
        current_putaway_package_qty: 0,
        current_putaway_base_qty: 0,
        target_location_code: "",
        roll_details: defaultRolls,
        productStatus: ((spuIndex + skuIndex) % 2 === 0 ? "成品" : "半成品") as ProductStatus,
        deliveryQuantity: baseQty,
        receivedQuantity: receivedBaseQty,
      };
    });
  }).flat();
  const deliveryQuantity = productItems.reduce((sum, item) => sum + item.deliveryQuantity, 0);
  const receivedQuantity = productItems.reduce((sum, item) => sum + item.receivedQuantity, 0);
  const status = getPreInboundStatus(receivedQuantity, deliveryQuantity);
  const trackingNo =
    courierCode === "JNE"
      ? `JNE${String(930000000000 + index * 137).padStart(12, "0")}`
      : courierCode === "JNT"
        ? `JP${String(7000000000 + index * 97).padStart(10, "0")}`
        : courierCode === "SICEPAT"
          ? `SICEPAT${String(58000000 + index * 23).padStart(8, "0")}`
          : `AJA${String(640000000 + index * 51).padStart(9, "0")}`;
  const relatedOrderNo = `${orderPrefix[index % orderPrefix.length]}-202604${String((index % 18) + 1).padStart(2, "0")}-${String(8600 + index).padStart(4, "0")}`;
  const inboundType = getInboundTypeByRelatedOrderNo(relatedOrderNo);
  const inboundWarehouse = inboundType === "原料采购入库" ? "原料仓" : "成衣仓库";

  const inboundOrderNo = `YRK-202604${String((index % 20) + 1).padStart(2, "0")}-${String(1000 + index).padStart(4, "0")}`;
  const baseMonth = inboundType === "原料采购入库" ? "03" : "04";
  const shippingTime = `2026-${baseMonth}-${String(1 + (index % 25)).padStart(2, "0")} ${String(8 + (index % 10)).padStart(2, "0")}:20`;
  const receivedTime =
    receivedQuantity > 0 ? `2026-${baseMonth}-${String(1 + (index % 25)).padStart(2, "0")} ${String(10 + (index % 8)).padStart(2, "0")}:10` : "";
  const matchedPutawayOrder = putawaySeed.find((item) => item.inboundOrderNo === inboundOrderNo && item.putawayQuantity > 0);
  const putawayTime = matchedPutawayOrder
    ? `2026-${baseMonth}-${String(1 + (index % 25)).padStart(2, "0")} ${String(12 + (index % 6)).padStart(2, "0")}:30`
    : "";

  return {
    id: `PI-${String(index + 1).padStart(4, "0")}`,
    inboundOrderNo,
    relatedOrderNo,
    inboundType,
    trackingNo,
    inboundWarehouse,
    productItems,
    deliveryUnit: deliveryUnits[index % deliveryUnits.length],
    deliveryQuantity,
    receivedQuantity,
    ownerName: subjectSeed[index % subjectSeed.length].name,
    operatorName: "",
    status,
    shippingTime,
    receivedTime,
    putawayTime,
  };
})];

// ---------------------------------------------------------------------------
// fabricScoreBase — first 4 hand-crafted fabric score items
// ---------------------------------------------------------------------------

const fabricScoreBase: FabricScoreItem[] = [
  {
    id: "FS-202603-001",
    image: makeFabricImage("1001", "#4F46E5"),
    spu: "SPU-ML-1001",
    fabricName: "莫代尔基础打底面料",
    details: makeFabricProducts("SPU-ML-1001", "#4F46E5", 1),
  },
  {
    id: "FS-202603-002",
    image: makeFabricImage("1012", "#0F766E"),
    spu: "SPU-ML-1012",
    fabricName: "精梳棉轻薄T恤面料",
    details: makeFabricProducts("SPU-ML-1012", "#0F766E", 2),
  },
  {
    id: "FS-202603-003",
    image: makeFabricImage("1038", "#B45309"),
    spu: "SPU-ML-1038",
    fabricName: "弹力罗纹针织面料",
    details: makeFabricProducts("SPU-ML-1038", "#B45309", 3),
  },
  {
    id: "FS-202603-004",
    image: makeFabricImage("1060", "#BE185D"),
    spu: "SPU-ML-1060",
    fabricName: "磨毛保暖内搭面料",
    details: makeFabricProducts("SPU-ML-1060", "#BE185D", 4),
  },
];

// ---------------------------------------------------------------------------
// fabricScoreSeed — 4 base items + 16 generated items (20 total)
// ---------------------------------------------------------------------------

export const fabricScoreSeed: FabricScoreItem[] = [
  ...fabricScoreBase,
  ...Array.from({ length: 16 }, (_, index) => {
    const skuNo = String(1061 + index);
    const color = ["#2563EB", "#0D9488", "#7C3AED", "#DC2626"][index % 4];
    const spu = `SPU-ML-${skuNo}`;
    const fabricNames = [
      "棉氨弹力打底面料",
      "莱赛尔垂感衬衫面料",
      "空气层卫衣面料",
      "亲肤针织家居面料",
      "基础工装裤装面料",
      "四季通勤上衣面料",
      "高弹坑条内搭面料",
      "轻户外运动面料",
    ];

    return {
      id: `FS-202603-${String(index + 5).padStart(3, "0")}`,
      image: makeFabricImage(skuNo, color),
      spu,
      fabricName: fabricNames[index % fabricNames.length],
      details: makeFabricProducts(spu, color, index + 5),
    };
  }),
];
