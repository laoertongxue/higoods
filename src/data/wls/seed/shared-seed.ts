// ============================================================================
// Shared / Cross-Warehouse Seed Data
// Foundation data: warehouse systems, navigation, subjects, warehouses, products,
// suppliers, processors, barcode rules, box codes, countries, transfer orders,
// PDA seeds, status/label maps, material template configs, stock flow constants,
// putaway seed, and warehouse biz-type helpers.
// Source: App.tsx lines 98-245, 867-877, 1374-1428, 3085-3094, 3524-3625,
//         5288-5404, 878-1111, 3648-3913, 4298-4392
// ============================================================================

import type {
  BarcodeRule,
  BarcodeObjectType,
  BoxCodeRecord,
  InboundTypeCode,
  MaterialCategory,
  MaterialTemplateConfig,
  MaterialTemplateMenuKey,
  MenuKey,
  OutboundTypeCode,
  PdaInboundOrder,
  PdaInventoryCheckTask,
  PdaMaterialTransferOrder,
  PdaMaterialTransferStatus,
  PdaOutboundOrder,
  PdaPickingTask,
  PdaPutawayTask,
  PdaMaterialTransferLine,
  PreInboundOrder,
  PreInboundStatus,
  ProductItem,
  ProductStatus,
  ProductSyncStatus,
  ProductType,
  ProcessorPartner,
  PutawayOrder,
  PutawayMode,
  PutawayStatus,
  PutawayType,
  ReturnOrderStatus,
  StockFlowDocType,
  StockFlowActionType,
  Subject,
  SubjectType,
  SupplierItem,
  TransferOrder,
  TransferOrderDetail,
  TransferOrderStatus,
  Warehouse,
  WarehouseBizType,
  WarehouseNavigationSection,
  WarehouseSystemKey,
  WarehouseTransferMenuKey,
  FinishedInventoryCountMenuKey,
} from "../types";

import {
  makeMaterialTransferNo,
  createMaterialTransferDraft,
} from "../shared/id-generators";

import {
  createWarehouseSeed,
  makeProductImage,
} from "../shared/seed-utils";

import {
  getPreInboundStatus,
} from "../shared/filters";

import {
  getInboundTypeByRelatedOrderNo,
} from "../shared/barcode";

import {
  warehouseTypeCodeMap,
} from "../shared/warehouse-config";

// ============================================================================
// Warehouse system definitions (App.tsx lines 103-120)
// ============================================================================

export const WAREHOUSE_SYSTEMS: Array<{ key: WarehouseSystemKey; label: string }> = [
  { key: "finished", label: "成衣仓" },
  { key: "transit", label: "中转仓" },
  { key: "raw", label: "原料仓" },
];

export const isWarehouseInSystem = (businessType: WarehouseBizType, system: WarehouseSystemKey) =>
  system === "finished"
    ? businessType === "FINISHED"
    : system === "transit"
      ? businessType === "TRANSIT"
      : !["FINISHED", "TRANSIT"].includes(businessType);

export const WAREHOUSE_SYSTEM_BIZ_TYPES: Record<WarehouseSystemKey, WarehouseBizType[]> = {
  finished: ["FINISHED"],
  transit: ["TRANSIT"],
  raw: ["FABRIC", "ACCESSORY", "YARN", "CONSUMABLE", "PACKAGING", "RAW_MATERIAL"],
};

// ============================================================================
// Warehouse navigation (App.tsx lines 122-235)
// ============================================================================

export const WAREHOUSE_NAVIGATION: Record<WarehouseSystemKey, WarehouseNavigationSection[]> = {
  finished: [
    { title: "工作台", items: [
      { key: "dashboard", label: "成衣仓首页", short: "首" },
      { key: "pdaOperation", label: "成衣仓 PDA", short: "P" },
      { key: "pdaShipScan", label: "PDA 扫码出库", short: "扫" },
      { key: "shipScan", label: "扫码出库", short: "出" },
    ] },
    { title: "入库管理", items: [
      { key: "preInbound", label: "预入库管理", short: "预" },
      { key: "putaway", label: "入库单列表", short: "入" },
      { key: "returnOrderList", label: "退货收货列表", short: "退" },
      { key: "returnQualityList", label: "退货质检列表", short: "质" },
      { key: "returnInboundList", label: "退货入库列表", short: "返" },
    ] },
    { title: "出库管理", items: [
      { key: "preOutbound", label: "预出库管理", short: "预" },
      { key: "outboundOrderList", label: "出库单列表", short: "单" },
      { key: "waveManage", label: "波次管理", short: "波" },
      { key: "multiItemPacking", label: "多件打包", short: "包" },
    ] },
    { title: "成衣仓集货管理", items: [
      { key: "collectionOrders", label: "集货订单", short: "订" },
      { key: "collectionPicking", label: "集货拣货波次", short: "拣" },
      { key: "collectionSorting", label: "二次分拨列表", short: "分" },
      { key: "collectionRemoval", label: "移出集货", short: "移" },
      { key: "collectionRecords", label: "集货记录", short: "记" },
    ] },
    { title: "库存管理", items: [
      { key: "stockRealtime", label: "即时库存查询", short: "即" },
      { key: "stockLocation", label: "仓位库存查询", short: "位" },
      { key: "stockFlow", label: "库存流水查询", short: "流" },
      { key: "stockTransfer", label: "移货操作", short: "移" },
      { key: "finishedRawInventoryCount", label: "库存盘点", short: "盘" },
    ] },
    { title: "智能分拣", items: [
      { key: "sorterMachineConfig", label: "分拣机配置", short: "机" },
      { key: "sorterGateConfig", label: "格口配置", short: "格" },
      { key: "sorterRecords", label: "异常记录", short: "异" },
    ] },
    { title: "基础管理", items: [
      { key: "warehouse", label: "仓库管理", short: "仓" },
      { key: "subject", label: "主体管理", short: "主" },
      { key: "zoneLocationManage", label: "库区库位管理", short: "库" },
      { key: "basketManage", label: "拣货篮管理", short: "篮" },
      { key: "collectionBoxMaster", label: "集货箱管理", short: "箱" },
      { key: "barcodeRule", label: "条码规则管理", short: "码" },
      { key: "labelConfig", label: "标签配置", short: "签" },
      { key: "productCenter", label: "商品中心", short: "商" },
    ] },
  ],
  transit: [
    { title: "工作台", items: [
      { key: "dashboard", label: "中转仓首页", short: "首" },
      { key: "transitOverview", label: "数据总览", short: "数" },
      { key: "pdaOperation", label: "中转仓 PDA", short: "P" },
    ] },
    { title: "中转仓作业", items: [
      { key: "transitReceiveManage", label: "预入库单管理", short: "预" },
      { key: "transitInboundManage", label: "收货单管理", short: "收" },
      { key: "transitKitCenter", label: "齐套校验中心", short: "齐" },
      { key: "transitAllocationManage", label: "配料任务管理", short: "配" },
      { key: "transitPutawayManage", label: "上架任务管理", short: "上" },
      { key: "transitWorkAreaManage", label: "作业区管理", short: "作" },
      { key: "transitOutboundManage", label: "出库单管理", short: "出" },
      { key: "transitInventoryManage", label: "中转仓库存", short: "库" },
      { key: "transitLocationManage", label: "中转仓库位", short: "位" },
      { key: "transitWarehouseTransfer", label: "中转仓调拨", short: "调" },
    ] },
    { title: "基础管理", items: [
      { key: "warehouse", label: "仓库管理", short: "仓" },
      { key: "subject", label: "主体管理", short: "主" },
      { key: "zoneLocationManage", label: "库区库位管理", short: "库" },
      { key: "processorManage", label: "加工方管理", short: "加" },
      { key: "barcodeRule", label: "条码规则管理", short: "码" },
      { key: "labelConfig", label: "标签配置", short: "签" },
    ] },
  ],
  raw: [
    { title: "工作台", items: [
      { key: "dashboard", label: "原料仓首页", short: "首" },
      { key: "pdaOperation", label: "原料仓 PDA", short: "P" },
    ] },
    { title: "原料入库", items: [
      { key: "materialArrivalList", label: "原料到货列表", short: "到" },
      { key: "materialInboundList", label: "入库单列表", short: "入" },
    ] },
    { title: "原料出库", items: [
      { key: "materialRequisitionList", label: "领料单列表", short: "领" },
      { key: "materialIssueList", label: "配料单列表", short: "配" },
      { key: "materialOutboundList", label: "出库单列表", short: "出" },
    ] },
    { title: "库存管理", items: [
      { key: "rawStockRealtime", label: "原料即时库存", short: "即" },
      { key: "rawStockLocation", label: "原料仓位库存", short: "位" },
      { key: "rawStockFlow", label: "原料库存流水", short: "流" },
      { key: "fabricRawInventoryCount", label: "面料盘点", short: "盘" },
      { key: "accessoryRawInventoryCount", label: "辅料盘点", short: "盘" },
      { key: "fabricWarehouseTransfer", label: "面料调拨", short: "调" },
      { key: "accessoryWarehouseTransfer", label: "辅料调拨", short: "调" },
    ] },
    { title: "数据分析", items: [{ key: "fabricScore", label: "面料评分", short: "分" }] },
    { title: "基础管理", items: [
      { key: "warehouse", label: "仓库管理", short: "仓" },
      { key: "subject", label: "主体管理", short: "主" },
      { key: "zoneLocationManage", label: "库区库位管理", short: "库" },
      { key: "barcodeRule", label: "条码规则管理", short: "码" },
      { key: "labelConfig", label: "标签配置", short: "签" },
      { key: "productCenter", label: "物料中心", short: "料" },
      { key: "supplier", label: "供应商管理", short: "供" },
      { key: "processorManage", label: "加工方管理", short: "加" },
    ] },
  ],
};

// ============================================================================
// Subject seed (inlined from warehouse-seed.ts)
// ============================================================================

const subjectBase: Subject[] = [
  {
    id: "ZT1001",
    name: "印尼万隆主体",
    type: "工厂",
    taxNo: "NPWP-88990011",
    bankAccount: "001122334455",
    contactName: "Dian",
    phone: "+62-811111111",
  },
  {
    id: "ZT1002",
    name: "雅加达电商主体",
    type: "平台",
    taxNo: "NPWP-33221100",
    bankAccount: "887766554433",
    contactName: "Rafi",
    phone: "+62-822222222",
  },
];

export const subjectSeed: Subject[] = [
  ...subjectBase,
  ...Array.from({ length: 20 }, (_, index) => ({
    id: `ZT${String(1003 + index).padStart(4, "0")}`,
    name: `示例主体${index + 1}`,
    type: (["工厂", "平台", "公司"] as SubjectType[])[index % 3],
    taxNo: `NPWP-${String(55000000 + index).padStart(8, "0")}`,
    bankAccount: `${600000000000 + index}`,
    contactName: ["Ayu", "Dian", "Rafi", "Bayu"][index % 4],
    phone: `+62-81${String(30000000 + index).padStart(8, "0")}`,
  })),
];

// ============================================================================
// Warehouse seed (inlined from warehouse-seed.ts)
// ============================================================================

export const warehouseSeed: Warehouse[] = [
  createWarehouseSeed("FINISHED", "中央总仓-成衣仓", 1, "Rina", "Bandung"),
  createWarehouseSeed("FINISHED", "成衣仓-深圳仓01", 2, "Rina", "Shenzhen"),
  createWarehouseSeed("FINISHED", "成衣仓-武汉仓01", 3, "Rina", "Wuhan"),
  createWarehouseSeed("FINISHED", "成衣仓-广州仓01", 4, "Rina", "Guangzhou"),
  createWarehouseSeed("FABRIC", "中央总仓-面料仓", 1, "Dian", "Bandung"),
  createWarehouseSeed("FABRIC", "面料仓-深圳仓01", 2, "Dian", "Shenzhen"),
  createWarehouseSeed("FABRIC", "面料仓-武汉仓01", 3, "Dian", "Wuhan"),
  createWarehouseSeed("FABRIC", "面料仓-广州仓01", 4, "Dian", "Guangzhou"),
  createWarehouseSeed("ACCESSORY", "中央总仓-辅料仓", 1, "Ayu", "Bandung"),
  createWarehouseSeed("ACCESSORY", "辅料仓-深圳仓01", 2, "Ayu", "Shenzhen"),
  createWarehouseSeed("ACCESSORY", "辅料仓-武汉仓01", 3, "Ayu", "Wuhan"),
  createWarehouseSeed("ACCESSORY", "辅料仓-广州仓01", 4, "Ayu", "Guangzhou"),
  createWarehouseSeed("YARN", "中央总仓-纱线仓", 1, "Bayu", "Bandung"),
  createWarehouseSeed("YARN", "纱线仓-深圳仓01", 2, "Bayu", "Shenzhen"),
  createWarehouseSeed("YARN", "纱线仓-武汉仓01", 3, "Bayu", "Wuhan"),
  createWarehouseSeed("YARN", "纱线仓-广州仓01", 4, "Bayu", "Guangzhou"),
  createWarehouseSeed("CONSUMABLE", "中央总仓-耗材仓", 1, "Putri", "Bandung"),
  createWarehouseSeed("CONSUMABLE", "耗材仓-深圳仓01", 2, "Putri", "Shenzhen"),
  createWarehouseSeed("CONSUMABLE", "耗材仓-武汉仓01", 3, "Putri", "Wuhan"),
  createWarehouseSeed("CONSUMABLE", "耗材仓-广州仓01", 4, "Putri", "Guangzhou"),
  createWarehouseSeed("PACKAGING", "中央总仓-包材仓", 1, "Rafi", "Bandung"),
  createWarehouseSeed("PACKAGING", "包材仓-深圳仓01", 2, "Rafi", "Shenzhen"),
  createWarehouseSeed("PACKAGING", "包材仓-武汉仓01", 3, "Rafi", "Wuhan"),
  createWarehouseSeed("PACKAGING", "包材仓-广州仓01", 4, "Rafi", "Guangzhou"),
  createWarehouseSeed("TRANSIT", "中央总仓-中转仓", 1, "Sari", "Bandung"),
  createWarehouseSeed("TRANSIT", "中转仓-深圳仓01", 2, "Sari", "Shenzhen"),
  createWarehouseSeed("TRANSIT", "中转仓-武汉仓01", 3, "Sari", "Wuhan"),
  createWarehouseSeed("TRANSIT", "中转仓-广州仓01", 4, "Sari", "Guangzhou"),
];

export const defaultPdaWarehouseIndex = Math.max(0, warehouseSeed.findIndex((warehouse) => warehouse.name === "成衣仓-深圳仓01"));

// ============================================================================
// Product seed (inlined from product-seed.ts)
// ============================================================================

export const productSeed: ProductItem[] = Array.from({ length: 18 }, (_, index) => {
  const colorPalette = ["#1D4ED8", "#0F766E", "#B45309", "#BE185D", "#7C3AED", "#0EA5E9", "#DC2626", "#2563EB"];
  const finishedGoodsNames = ["基础T恤", "通勤衬衫", "休闲卫衣", "轻暖打底", "修身针织", "运动裤装", "防晒外套", "商务西裤", "训练短裤"];
  const materialNames = ["弹力平纹布", "树脂纽扣", "防潮包装袋", "精梳棉纱", "磨毛面料", "金属拉链", "纸箱内衬", "再生纱线", "热熔衬布"];
  const unitPool = ["件", "卷", "匹", "包", "个", "kg", "压"];
  const packageUnitPool: Array<"卷" | "压" | "包" | "箱"> = ["卷", "压", "包", "箱"];
  const materialCategoryPool: MaterialCategory[] = ["FABRIC", "ACCESSORY", "PACKAGING", "YARN"];
  const syncStatusPool: ProductSyncStatus[] = ["同步成功", "同步成功", "同步成功", "同步中", "同步失败"];
  const isMaterial = index % 3 === 1;
  const productType: ProductType = isMaterial ? "MATERIAL" : "FINISHED_GOODS";
  const materialCategory = productType === "MATERIAL" ? materialCategoryPool[index % materialCategoryPool.length] : null;
  const spu = `SPU-GC-${String(1001 + index).padStart(4, "0")}`;
  const syncHour = 8 + (index % 10);
  const syncMinute = (10 + index * 3) % 60;
  const status = syncStatusPool[index % syncStatusPool.length];
  const unit = productType === "MATERIAL" ? unitPool[(index + 1) % unitPool.length] : "件";
  const packageUnit = packageUnitPool[index % packageUnitPool.length];
  const specs: Record<string, string> =
    productType === "MATERIAL"
      ? {
          克重: `${180 + (index % 6) * 20}g`,
          幅宽: `${140 + (index % 3) * 10}cm`,
          等级: index % 2 === 0 ? "A级" : "B级",
        }
      : {
          颜色: ["黑色", "白色", "藏青", "卡其"][index % 4],
          尺码: ["S", "M", "L", "XL"][index % 4],
          季节: ["春", "夏", "秋", "冬"][index % 4],
        };
  return {
    id: `PC-${String(index + 1).padStart(4, "0")}`,
    image: makeProductImage(spu.slice(-4), colorPalette[index % colorPalette.length]),
    productName:
      productType === "MATERIAL"
        ? `${materialNames[index % materialNames.length]} ${String.fromCharCode(65 + (index % 8))}`
        : `${finishedGoodsNames[index % finishedGoodsNames.length]} ${String.fromCharCode(65 + (index % 8))}款`,
    spu,
    sku: `SKU-GC-${String(20001 + index).padStart(5, "0")}`,
    productType,
    materialCategory,
    unit,
    packageUnit,
    sourceSystem: "商品中心",
    syncTime: `2026-05-${String((index % 9) + 1).padStart(2, "0")} ${String(syncHour).padStart(2, "0")}:${String(syncMinute).padStart(2, "0")}`,
    status,
    specs,
  };
});

// ============================================================================
// Supplier seed (inlined from product-seed.ts)
// ============================================================================

export const supplierSeed: SupplierItem[] = Array.from({ length: 26 }, (_, index) => {
  const supplierNames = [
    "万隆纺织供应链有限公司",
    "雅加达面辅料贸易商行",
    "泗水针织原料有限公司",
    "雅加达成衣制造厂",
    "万隆快反工厂",
    "巴厘岛辅料中心",
  ];
  const contactNames = ["Ayu", "Dian", "Rina", "Bayu", "Tari", "Rafi"];
  return {
    code: `SUP-${String(1001 + index).padStart(4, "0")}`,
    name: supplierNames[index % supplierNames.length],
    contactName: contactNames[index % contactNames.length],
    phone: `08${String(112300000 + index * 127).padStart(9, "0")}`,
  };
});

// ============================================================================
// Processor partner seed (inlined from product-seed.ts)
// ============================================================================

export const processorPartnerSeed: ProcessorPartner[] = [
  {
    code: "PROC-IN-001",
    name: "自有工厂 A组",
    processorType: "INTERNAL",
    pickupRule: "ALLOW_PARTIAL",
    contactName: "Ayu",
    phone: "08112300101",
    address: "雅加达自有生产园区 A 栋",
    status: "ENABLED",
    remark: "未齐套时允许通知工厂部分领料",
  },
  {
    code: "PROC-OUT-001",
    name: "第三方工厂-恒盛",
    processorType: "OUTSOURCED",
    pickupRule: "KIT_ONLY",
    contactName: "Dian",
    phone: "08112300102",
    address: "万隆外协加工区 6 号",
    status: "ENABLED",
    remark: "必须齐套后才允许配料与出库",
  },
  {
    code: "PROC-IN-002",
    name: "自有工厂 B组",
    processorType: "INTERNAL",
    pickupRule: "ALLOW_PARTIAL",
    contactName: "Rina",
    phone: "08112300103",
    address: "雅加达自有生产园区 B 栋",
    status: "ENABLED",
    remark: "可承接中转仓直接领料",
  },
  {
    code: "PROC-OUT-002",
    name: "印花厂",
    processorType: "OUTSOURCED",
    pickupRule: "KIT_ONLY",
    contactName: "Bayu",
    phone: "08112300104",
    address: "泗水印花工业园",
    status: "ENABLED",
    remark: "第三方加工方，按齐套后交付",
  },
];

// ============================================================================
// Label maps (App.tsx lines 5288-5310)
// ============================================================================

export const productTypeLabelMap: Record<ProductType, string> = {
  FINISHED_GOODS: "成衣商品",
  MATERIAL: "面辅料物料",
};

export const materialCategoryLabelMap: Record<MaterialCategory, string> = {
  FABRIC: "面料",
  ACCESSORY: "辅料",
  CONSUMABLE: "耗材",
  PACKAGING: "包材",
  YARN: "纱线",
};

export const warehouseBizTypeLabelMap: Record<WarehouseBizType, string> = {
  FINISHED: "中央总仓-成衣仓",
  RAW_MATERIAL: "中央总仓-面料仓",
  FABRIC: "中央总仓-面料仓",
  ACCESSORY: "中央总仓-辅料仓",
  PACKAGING: "中央总仓-包材仓",
  YARN: "中央总仓-纱线仓",
  CONSUMABLE: "中央总仓-耗材仓",
  TRANSIT: "中央总仓-中转仓",
};

// ============================================================================
// Material template configs (App.tsx lines 5312-5404)
// ============================================================================

export const materialTemplateConfigs: MaterialTemplateConfig[] = [
  { key: "fabric", label: "面料", short: "面", businessType: "FABRIC", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "accessory", label: "辅料", short: "辅", businessType: "ACCESSORY", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "yarn", label: "纱线", short: "纱", businessType: "YARN", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "consumable", label: "耗材", short: "耗", businessType: "CONSUMABLE", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "packaging", label: "包材", short: "包", businessType: "PACKAGING", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "transit", label: "中转", short: "转", businessType: "TRANSIT", inboundType: "TRANSIT_RETURN_INBOUND", outboundType: "TRANSIT_MATERIAL_OUTBOUND" },
];

export const materialInboundTemplateConfigs = materialTemplateConfigs.filter((config) => config.key !== "transit");
export const materialLegacyTemplateConfigs = materialTemplateConfigs.filter((config) => config.key !== "transit");

export const materialTemplateMenuMap = materialLegacyTemplateConfigs.flatMap((config) => [
  { key: `${config.key}MaterialArrivalList` as MaterialTemplateMenuKey, config, baseMenu: config.key === "transit" ? "transitReturnList" : "materialArrivalList" },
  { key: `${config.key}MaterialInboundList` as MaterialTemplateMenuKey, config, baseMenu: config.key === "transit" ? "transitInboundList" : "materialInboundList" },
  { key: `${config.key}MaterialRequisitionList` as MaterialTemplateMenuKey, config, baseMenu: config.key === "transit" ? "transitMaterialList" : "materialRequisitionList" },
  { key: `${config.key}MaterialIssueList` as MaterialTemplateMenuKey, config, baseMenu: config.key === "transit" ? "transitIssueList" : "materialIssueList" },
  { key: `${config.key}MaterialOutboundList` as MaterialTemplateMenuKey, config, baseMenu: config.key === "transit" ? "transitOutboundList" : "materialOutboundList" },
  { key: `${config.key}RawInventoryCount` as MaterialTemplateMenuKey, config, baseMenu: "rawInventoryCount" },
  { key: `${config.key}RawInventoryCountDetail` as MaterialTemplateMenuKey, config, baseMenu: "rawInventoryCountDetail" },
]);

export const getMaterialTemplateRoute = (key: MenuKey) => materialTemplateMenuMap.find((item) => item.key === key);

export const getMaterialTemplateMenuLabel = (key: MaterialTemplateMenuKey, config: MaterialTemplateConfig) =>
  key.endsWith("MaterialArrivalList")
    ? `${config.label}到货列表`
    : key.endsWith("MaterialInboundList")
      ? `${config.label}入库单列表`
      : key.endsWith("MaterialRequisitionList")
        ? `${config.label}领料单列表`
        : key.endsWith("MaterialIssueList")
          ? `${config.label}配料单列表`
          : key.endsWith("MaterialOutboundList")
            ? `${config.label}出库单列表`
            : key.endsWith("RawInventoryCountDetail")
              ? `${config.label}仓盘点详情`
              : key.endsWith("RawInventoryCount")
                ? `${config.label}仓盘点`
                : `${config.label}页面`;

export const materialTemplateMenuKeys = materialTemplateMenuMap.map((item) => item.key);
export const isMaterialTemplateMenu = (key: MenuKey): key is MaterialTemplateMenuKey =>
  materialTemplateMenuKeys.includes(key as MaterialTemplateMenuKey);

export const finishedInventoryCountMenuMap = [
  { key: "finishedRawInventoryCount" as const, baseMenu: "rawInventoryCount" as const, label: "中央总仓-成衣仓盘点" },
  { key: "finishedRawInventoryCountDetail" as const, baseMenu: "rawInventoryCountDetail" as const, label: "中央总仓-成衣仓盘点详情" },
];

export const getFinishedInventoryCountRoute = (key: MenuKey) => finishedInventoryCountMenuMap.find((item) => item.key === key);
export const isFinishedInventoryCountMenu = (key: MenuKey): key is FinishedInventoryCountMenuKey =>
  Boolean(getFinishedInventoryCountRoute(key));

export const warehouseTransferConfigs = [
  { key: "finished", label: "成衣仓", businessType: "FINISHED" as WarehouseBizType },
  ...materialTemplateConfigs.map((config) => ({
    key: config.key,
    label: `${config.label}仓`,
    businessType: config.businessType,
  })),
] as const;

export const warehouseTransferMenuMap = warehouseTransferConfigs.map((config) => ({
  key: `${config.key}WarehouseTransfer` as WarehouseTransferMenuKey,
  config,
  baseMenu: "materialTransfer" as const,
}));

export const getWarehouseTransferRoute = (key: MenuKey) => warehouseTransferMenuMap.find((item) => item.key === key);
export const warehouseTransferMenuKeys = warehouseTransferMenuMap.map((item) => item.key);
export const isWarehouseTransferMenu = (key: MenuKey): key is WarehouseTransferMenuKey =>
  warehouseTransferMenuKeys.includes(key as WarehouseTransferMenuKey);

// ============================================================================
// Warehouse biz-type helpers (App.tsx lines 5393-5404)
// ============================================================================

export const materialCategoryByBizType: Partial<Record<WarehouseBizType, MaterialCategory>> = {
  FABRIC: "FABRIC",
  ACCESSORY: "ACCESSORY",
  YARN: "YARN",
  CONSUMABLE: "CONSUMABLE",
  PACKAGING: "PACKAGING",
};

export const rawWarehouseBizTypes: WarehouseBizType[] = ["RAW_MATERIAL", "FABRIC", "ACCESSORY", "PACKAGING", "YARN", "CONSUMABLE"];
export const isRawWarehouseBizType = (businessType?: WarehouseBizType) => Boolean(businessType && rawWarehouseBizTypes.includes(businessType));
export const isWarehouseBizTypeMatch = (actual?: WarehouseBizType, expected?: WarehouseBizType | null) =>
  !expected || (expected === "RAW_MATERIAL" ? isRawWarehouseBizType(actual) : actual === expected);

// ============================================================================
// Transfer status label map (App.tsx lines 867-877)
// ============================================================================

export const transferStatusLabelMap: Record<TransferOrderStatus, string> = {
  DRAFT: "草稿",
  WAIT_PICK: "待拣货",
  PICKING: "拣货中",
  WAIT_SEND: "待发出",
  IN_TRANSIT: "在途",
  WAIT_SIGN: "待签收",
  COMPLETED: "已完成",
  EXCEPTION: "异常",
  CANCELLED: "已取消",
};

// ============================================================================
// Return status flow (App.tsx line 3121)
// ============================================================================

export const RETURN_STATUS_FLOW: ReturnOrderStatus[] = ["待收货", "待质检", "待入库", "待上架", "已完成"];

// ============================================================================
// Status label maps (App.tsx lines 1374-1428)
// ============================================================================

export const MATERIAL_STOCK_STATUS_LABEL: Record<string, string> = {
  STOCK_SUFFICIENT: "库存充足",
  STOCK_PARTIAL_SUFFICIENT: "库存部分充足",
  STOCK_INSUFFICIENT: "库存不足",
};

export const FACTORY_CONFIRM_STATUS_LABEL: Record<string, string> = {
  NOT_REQUIRED: "无需确认",
  PENDING_CONFIRM: "待工厂确认",
  CONFIRMED: "工厂确认领取",
  REJECTED: "工厂拒绝领取",
  CANCELLED: "已取消",
};

export const MATERIAL_PICKING_STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  WAIT_PICKING: "待配料",
  PICKING: "配料中",
  PICKING_DONE: "配料完成",
  WAIT_OUTBOUND: "待生成出库单",
  OUTBOUND_CREATED: "已生成出库单",
  OUTBOUND_DONE: "已出库",
  COMPLETED: "已完结",
  CANCELLED: "已取消",
  SHORTAGE_PENDING_CONFIRM: "少拣待确认",
  FACTORY_REJECTED: "工厂拒绝领取",
};

export const isMaterialPickingPdaVisible = (status?: string) => status === "WAIT_PICKING" || status === "PICKING";

export const REQUISITION_STATUS_LABEL: Record<string, string> = {
  WAIT_STOCK_CHECK: "待库存校验",
  STOCK_CHECKED: "库存已校验",
  PICKING_CREATED: "已生成配料单",
  PARTIAL_PICKING_CREATED: "已生成部分配料单",
  PICKING_DONE: "配料完成",
  PARTIAL_PICKING_DONE: "部分配料完成",
  PENDING_FACTORY_CONFIRM: "待工厂确认",
  FACTORY_CONFIRMED: "工厂确认领取",
  FACTORY_REJECTED: "工厂拒绝领取",
  OUTBOUND_CREATED: "已生成出库单",
  STOCK_INSUFFICIENT: "库存不足",
  CANCELLED: "已取消",
};

export const STOCK_LINE_JUDGEMENT_LABEL: Record<string, string> = {
  SUFFICIENT: "库存充足",
  PARTIAL_SUFFICIENT: "部分充足",
  INSUFFICIENT: "库存不足",
};

export const MATERIAL_STOCK_PARTIAL_THRESHOLD = 0.3;
export const INTEGER_MATERIAL_UNITS = new Set(["件", "颗", "个", "条", "粒", "枚", "PCS", "pc", "pcs"]);

// ============================================================================
// Barcode object type options (App.tsx lines 3085-3094)
// ============================================================================

export const barcodeObjectTypeOptions: BarcodeObjectType[] = [
  "商品SKU",
  "收货单",
  "上架单",
  "拣货单",
  "出库单",
  "移库单",
  "移货单",
  "库区库位",
];

// ============================================================================
// Stock flow constants (App.tsx lines 3524-3555)
// ============================================================================

export const STOCK_FLOW_DOC_TYPES: StockFlowDocType[] = ["收货单", "上架单", "拣货单", "出库单", "退货单", "移货单", "盘点单", "调整单"];

export const STOCK_FLOW_ACTION_TYPES: StockFlowActionType[] = [
  "收货入库",
  "上架入库",
  "锁定库存",
  "释放锁定",
  "销售出库",
  "退货入库",
  "移货",
  "盘盈",
  "盘亏",
  "手工调整",
];

export const STOCK_FLOW_METRIC_COLUMNS = [
  { label: "总库存", changeKey: "totalStockChange", beforeKey: "totalStockBefore", afterKey: "totalStockAfter" },
  { label: "现货库存", changeKey: "spotStockChange", beforeKey: "spotStockBefore", afterKey: "spotStockAfter" },
  { label: "在途库存", changeKey: "transitStockChange", beforeKey: "transitStockBefore", afterKey: "transitStockAfter" },
  {
    label: "退货待检库存",
    changeKey: "pendingReturnQualityChange",
    beforeKey: "pendingReturnQualityBefore",
    afterKey: "pendingReturnQualityAfter",
  },
  { label: "瑕疵品库存", changeKey: "defectiveStockChange", beforeKey: "defectiveStockBefore", afterKey: "defectiveStockAfter" },
  { label: "破损库存", changeKey: "damagedStockChange", beforeKey: "damagedStockBefore", afterKey: "damagedStockAfter" },
  { label: "预售订单占用库存", changeKey: "preSaleOccupiedChange", beforeKey: "preSaleOccupiedBefore", afterKey: "preSaleOccupiedAfter" },
  { label: "现货订单占用库存", changeKey: "spotOrderOccupiedChange", beforeKey: "spotOrderOccupiedBefore", afterKey: "spotOrderOccupiedAfter" },
  { label: "可售库存", changeKey: "availableStockChange", beforeKey: "availableStockBefore", afterKey: "availableStockAfter" },
] as const;

export const STOCK_FLOW_STICKY_LEFT = [0, 112, 224, 336, 448] as const;

// ============================================================================
// Countries & timezones (App.tsx lines 3557-3625)
// ============================================================================

export const COUNTRIES = [
  "China",
  "Indonesia",
  "Singapore",
  "Malaysia",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Japan",
  "South Korea",
  "India",
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "Chile",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Belgium",
  "Poland",
  "Russia",
  "Türkiye",
  "Saudi Arabia",
  "United Arab Emirates",
  "South Africa",
  "Egypt",
  "Australia",
  "New Zealand",
];

export const COUNTRY_TIMEZONE: Record<string, string> = {
  China: "Asia/Shanghai",
  Indonesia: "Asia/Jakarta",
  Singapore: "Asia/Singapore",
  Malaysia: "Asia/Kuala_Lumpur",
  Thailand: "Asia/Bangkok",
  Vietnam: "Asia/Ho_Chi_Minh",
  Philippines: "Asia/Manila",
  Japan: "Asia/Tokyo",
  "South Korea": "Asia/Seoul",
  India: "Asia/Kolkata",
  "United States": "America/New_York",
  Canada: "America/Toronto",
  Mexico: "America/Mexico_City",
  Brazil: "America/Sao_Paulo",
  Argentina: "America/Argentina/Buenos_Aires",
  Chile: "America/Santiago",
  "United Kingdom": "Europe/London",
  Germany: "Europe/Berlin",
  France: "Europe/Paris",
  Italy: "Europe/Rome",
  Spain: "Europe/Madrid",
  Netherlands: "Europe/Amsterdam",
  Belgium: "Europe/Brussels",
  Poland: "Europe/Warsaw",
  Russia: "Europe/Moscow",
  Türkiye: "Europe/Istanbul",
  "Saudi Arabia": "Asia/Riyadh",
  "United Arab Emirates": "Asia/Dubai",
  "South Africa": "Africa/Johannesburg",
  Egypt: "Africa/Cairo",
  Australia: "Australia/Sydney",
  "New Zealand": "Pacific/Auckland",
};

// ============================================================================
// Putaway seed (inlined from inbound-putaway-seed.ts)
// ============================================================================

export const putawaySeed: PutawayOrder[] = [
  {
    orderNo: "PA-20260409-9001",
    inboundOrderNo: "YRK-20260401-1000",
    paNo: "PA-20260409-9001",
    relatedReceiptNo: "PA-20260409-9001",
    putawayType: "标准上架",
    status: "待上架",
    inboundQuantity: 860,
    putawayMode: "手动上架",
    spuCode: "SPU-BDG-901",
    skuCode: "SKU-BDG-901",
    batchNo: "PA-20260409-9001",
    sourceLocation: "拣货区01",
    targetLocation: "A-R01-01-01",
    putawayQuantity: 0,
    operatorName: "",
  },
  {
    orderNo: "PA-20260409-9002",
    inboundOrderNo: "YRK-20260402-1001",
    paNo: "PA-20260409-9002",
    relatedReceiptNo: "PA-20260409-9002",
    putawayType: "越库上架（虚拟）",
    status: "待上架",
    inboundQuantity: 600,
    putawayMode: "手动上架",
    spuCode: "SPU-JKT-902",
    skuCode: "SKU-JKT-902",
    batchNo: "PA-20260409-9002",
    sourceLocation: "拣货区01",
    targetLocation: "A-R01-01-02",
    putawayQuantity: 0,
    operatorName: "",
  },
  {
    orderNo: "PA-20260409-9003",
    inboundOrderNo: "YRK-20260403-1002",
    paNo: "PA-20260409-9003",
    relatedReceiptNo: "PA-20260409-9003",
    putawayType: "调拨上架",
    status: "上架完成",
    inboundQuantity: 780,
    putawayMode: "手动上架",
    spuCode: "SPU-BDG-903",
    skuCode: "SKU-BDG-903",
    batchNo: "PA-20260409-9003",
    sourceLocation: "货架区TK",
    targetLocation: "A-R01-01-03",
    putawayQuantity: 780,
    operatorName: "",
  },
  {
    orderNo: "PA-20260430-9101",
    inboundOrderNo: "YRK-20260417-1016",
    paNo: "PA-20260430-9101",
    relatedReceiptNo: "PA-20260430-9101",
    putawayType: "标准上架",
    status: "待上架",
    inboundQuantity: 35,
    putawayMode: "手动上架",
    spuCode: "SPU-PI-35101",
    skuCode: "SKU-PI-35101",
    batchNo: "PA-20260430-9101",
    sourceLocation: "拣货区01",
    targetLocation: "A-R01-02-01",
    putawayQuantity: 0,
    itemLines: [
      { spuCode: "SPU-PI-35101", skuCode: "SKU-PI-35101", inboundQuantity: 12, putawayQuantity: 0, targetLocation: "A-R01-02-01" },
      { spuCode: "SPU-PI-35102", skuCode: "SKU-PI-35102", inboundQuantity: 8, putawayQuantity: 0, targetLocation: "A-R01-02-02" },
      { spuCode: "SPU-PI-35103", skuCode: "SKU-PI-35103", inboundQuantity: 15, putawayQuantity: 0, targetLocation: "A-R01-02-03" },
    ],
    operatorName: "",
  },
  {
    orderNo: "PA-20260430-9102",
    inboundOrderNo: "YRK-20260418-1017",
    paNo: "PA-20260430-9102",
    relatedReceiptNo: "PA-20260430-9102",
    putawayType: "标准上架",
    status: "待上架",
    inboundQuantity: 31,
    putawayMode: "手动上架",
    spuCode: "SPU-PI-35201",
    skuCode: "SKU-PI-35201",
    batchNo: "PA-20260430-9102",
    sourceLocation: "拣货区01",
    targetLocation: "A-R01-02-02",
    putawayQuantity: 0,
    itemLines: [
      { spuCode: "SPU-PI-35201", skuCode: "SKU-PI-35201", inboundQuantity: 6, putawayQuantity: 0, targetLocation: "A-R01-01-01" },
      { spuCode: "SPU-PI-35202", skuCode: "SKU-PI-35202", inboundQuantity: 9, putawayQuantity: 0, targetLocation: "A-R01-01-02" },
      { spuCode: "SPU-PI-35203", skuCode: "SKU-PI-35203", inboundQuantity: 4, putawayQuantity: 0, targetLocation: "A-R01-01-03" },
      { spuCode: "SPU-PI-35204", skuCode: "SKU-PI-35204", inboundQuantity: 7, putawayQuantity: 0, targetLocation: "A-R01-02-01" },
      { spuCode: "SPU-PI-35205", skuCode: "SKU-PI-35205", inboundQuantity: 5, putawayQuantity: 0, targetLocation: "A-R01-02-02" },
    ],
    operatorName: "",
  },
  {
    orderNo: "PA-20260430-9103",
    inboundOrderNo: "YRK-20260419-1018",
    paNo: "PA-20260430-9103",
    relatedReceiptNo: "PA-20260430-9103",
    putawayType: "标准上架",
    status: "待上架",
    inboundQuantity: 63,
    putawayMode: "手动上架",
    spuCode: "SPU-PI-35301",
    skuCode: "SKU-PI-35301",
    batchNo: "PA-20260430-9103",
    sourceLocation: "拣货区01",
    targetLocation: "A-R01-01-03",
    putawayQuantity: 0,
    itemLines: [
      { spuCode: "SPU-PI-35301", skuCode: "SKU-PI-35301", inboundQuantity: 10, putawayQuantity: 0, targetLocation: "A-R01-01-01" },
      { spuCode: "SPU-PI-35302", skuCode: "SKU-PI-35302", inboundQuantity: 12, putawayQuantity: 0, targetLocation: "A-R01-01-02" },
      { spuCode: "SPU-PI-35303", skuCode: "SKU-PI-35303", inboundQuantity: 6, putawayQuantity: 0, targetLocation: "A-R01-01-03" },
      { spuCode: "SPU-PI-35304", skuCode: "SKU-PI-35304", inboundQuantity: 8, putawayQuantity: 0, targetLocation: "A-R01-02-01" },
      { spuCode: "SPU-PI-35305", skuCode: "SKU-PI-35305", inboundQuantity: 9, putawayQuantity: 0, targetLocation: "A-R01-02-02" },
      { spuCode: "SPU-PI-35306", skuCode: "SKU-PI-35306", inboundQuantity: 11, putawayQuantity: 0, targetLocation: "A-R01-02-03" },
      { spuCode: "SPU-PI-35307", skuCode: "SKU-PI-35307", inboundQuantity: 7, putawayQuantity: 0, targetLocation: "货架区TK" },
    ],
    operatorName: "",
  },
  {
    orderNo: "PA-20260512-3001",
    inboundOrderNo: "YRK-20260512-3001",
    paNo: "PA-20260512-3001",
    relatedReceiptNo: "PA-20260512-3001",
    putawayType: "标准上架",
    status: "待上架",
    inboundQuantity: 4080,
    putawayMode: "手动上架",
    spuCode: "SPU-RAW-1001",
    skuCode: "SKU-RAW-50001",
    batchNo: "PA-20260512-3001",
    sourceLocation: "原料待上架区",
    targetLocation: "FAB-A-01",
    putawayQuantity: 0,
    itemLines: [
      { spuCode: "SPU-RAW-1001", skuCode: "SKU-RAW-50001", inboundQuantity: 80, putawayQuantity: 0, targetLocation: "FAB-A-01" },
      { spuCode: "SPU-RAW-1002", skuCode: "SKU-RAW-50002", inboundQuantity: 4000, putawayQuantity: 0, targetLocation: "ACC-A-01" },
    ],
    operatorName: "",
  },
  {
    orderNo: "PA-20260512-3002",
    inboundOrderNo: "YRK-20260512-3002",
    paNo: "PA-20260512-3002",
    relatedReceiptNo: "PA-20260512-3002",
    putawayType: "标准上架",
    status: "部分上架",
    inboundQuantity: 2600,
    putawayMode: "手动上架",
    spuCode: "SPU-RAW-1011",
    skuCode: "SKU-RAW-50011",
    batchNo: "PA-20260512-3002",
    sourceLocation: "原料待上架区",
    targetLocation: "PKG-B-01",
    putawayQuantity: 1000,
    itemLines: [
      { spuCode: "SPU-RAW-1011", skuCode: "SKU-RAW-50011", inboundQuantity: 2000, putawayQuantity: 1000, targetLocation: "PKG-B-01" },
      { spuCode: "SPU-RAW-1012", skuCode: "SKU-RAW-50012", inboundQuantity: 600, putawayQuantity: 0, targetLocation: "YARN-C-02" },
    ],
    operatorName: "仓库主管",
  },
  {
    orderNo: "PA-20260513-3003",
    inboundOrderNo: "YRK-20260513-3003",
    paNo: "PA-20260513-3003",
    relatedReceiptNo: "PA-20260513-3003",
    putawayType: "标准上架",
    status: "待上架",
    inboundQuantity: 0,
    putawayMode: "手动上架",
    spuCode: "SPU-RAW-1021",
    skuCode: "SKU-RAW-50021",
    batchNo: "PA-20260513-3003",
    sourceLocation: "原料待上架区",
    targetLocation: "CON-D-01",
    putawayQuantity: 0,
    itemLines: [{ spuCode: "SPU-RAW-1021", skuCode: "SKU-RAW-50021", inboundQuantity: 0, putawayQuantity: 0, targetLocation: "CON-D-01" }],
    operatorName: "",
  },
  ...Array.from({ length: 16 }, (_, index) => {
    const orderNo = `PA-20260410-${String(index + 1).padStart(4, "0")}`;
    const inboundOrderNo = `YRK-202604${String((index % 20) + 1).padStart(2, "0")}-${String(1000 + index).padStart(4, "0")}`;
    const putawayType = (["标准上架", "越库上架（虚拟）", "调拨上架"] as PutawayType[])[index % 3];
    const deliveryQuantity = 420 + index * 35;
    const status = (["待上架", "部分上架", "上架完成"] as PutawayStatus[])[index % 3];
    const inboundQuantity = status === "待上架" ? Math.floor(deliveryQuantity * 0.7) : deliveryQuantity;
    const putawayQuantity =
      status === "待上架"
        ? 0
        : status === "部分上架"
          ? Math.max(1, Math.floor(inboundQuantity * 0.5))
          : inboundQuantity;
    return {
      orderNo,
      inboundOrderNo,
      paNo: orderNo,
      relatedReceiptNo: orderNo,
      putawayType,
      status,
      inboundQuantity,
      putawayMode: "手动上架" as PutawayMode,
      spuCode: `SPU-${index % 2 === 0 ? "BDG" : "JKT"}-${String(910 + index).padStart(3, "0")}`,
      skuCode: `SKU-${index % 2 === 0 ? "BDG" : "JKT"}-${String(910 + index).padStart(3, "0")}`,
      batchNo: orderNo,
      sourceLocation: status === "上架完成" ? "货架区TK" : "拣货区01",
      targetLocation: ["A-R01-01-01", "A-R01-01-02", "A-R01-01-03", "A-R01-02-01", "A-R01-02-02", "A-R01-02-03", "货架区TK"][index % 7],
      putawayQuantity,
      operatorName: "",
    };
  }),
];

// ============================================================================
// Transfer-order configuration maps
// ============================================================================

export const transferWarehouseNamesByBizType: Record<WarehouseBizType, string[]> = {
  FINISHED: ["中央总仓-成衣仓", "成衣仓-深圳仓01", "成衣仓-武汉仓01", "成衣仓-广州仓01"],
  RAW_MATERIAL: ["中央总仓-面料仓", "面料仓-深圳仓01", "面料仓-武汉仓01", "面料仓-广州仓01"],
  FABRIC: ["中央总仓-面料仓", "面料仓-深圳仓01", "面料仓-武汉仓01", "面料仓-广州仓01"],
  ACCESSORY: ["中央总仓-辅料仓", "辅料仓-深圳仓01", "辅料仓-武汉仓01", "辅料仓-广州仓01"],
  YARN: ["中央总仓-纱线仓", "纱线仓-深圳仓01", "纱线仓-武汉仓01", "纱线仓-广州仓01"],
  CONSUMABLE: ["中央总仓-耗材仓", "耗材仓-深圳仓01", "耗材仓-武汉仓01", "耗材仓-广州仓01"],
  PACKAGING: ["中央总仓-包材仓", "包材仓-深圳仓01", "包材仓-武汉仓01", "包材仓-广州仓01"],
  TRANSIT: ["中央总仓-中转仓", "中转仓-深圳仓01", "中转仓-武汉仓01", "中转仓-广州仓01"],
};

export const transferMaterialCategoryByBizType: Partial<Record<WarehouseBizType, MaterialCategory>> = {
  FABRIC: "FABRIC",
  ACCESSORY: "ACCESSORY",
  YARN: "YARN",
  CONSUMABLE: "PACKAGING",
  PACKAGING: "PACKAGING",
  TRANSIT: "PACKAGING",
};

export const transferUomByCategory: Record<MaterialCategory, { packageUnit: "卷" | "包" | "箱" | "袋"; baseUnit: "米" | "颗" | "个" | "kg"; ratio: number }> = {
  FABRIC: { packageUnit: "卷", baseUnit: "米", ratio: 80 },
  ACCESSORY: { packageUnit: "包", baseUnit: "颗", ratio: 200 },
  PACKAGING: { packageUnit: "箱", baseUnit: "个", ratio: 120 },
  YARN: { packageUnit: "包", baseUnit: "kg", ratio: 25 },
  CONSUMABLE: { packageUnit: "包", baseUnit: "个", ratio: 60 },
};

// ============================================================================
// Transfer-order seed builder
// ============================================================================

const buildMaterialTransferSeeds = (): { orders: TransferOrder[]; details: TransferOrderDetail[] } => {
  const transferCodePrefixMap: Record<WarehouseBizType, string> = {
    FINISHED: "GMT",
    RAW_MATERIAL: "FAB",
    FABRIC: "FAB",
    ACCESSORY: "TRM",
    YARN: "YRN",
    CONSUMABLE: "CON",
    PACKAGING: "PKG",
    TRANSIT: "TSF",
  };
  const orders: TransferOrder[] = [];
  const details: TransferOrderDetail[] = [];
  let serial = 1001;
  let dayOffset = 10;

  const transferBizTypes: WarehouseBizType[] = ["FINISHED", "FABRIC", "ACCESSORY", "YARN", "CONSUMABLE", "PACKAGING", "TRANSIT"];
  transferBizTypes.forEach((bizType) => {
    const warehouses = transferWarehouseNamesByBizType[bizType];
    const category = transferMaterialCategoryByBizType[bizType] || "FABRIC";
    const uom = transferUomByCategory[category];

    warehouses.forEach((fromWarehouse, warehouseIndex) => {
      for (let orderIndex = 0; orderIndex < 3; orderIndex += 1) {
        const toWarehouse = warehouses[(warehouseIndex + orderIndex + 1) % warehouses.length];
        const transferNo = `MFT-202605${String(dayOffset).padStart(2, "0")}-${serial}`;
        const packageQtyA = 1 + ((warehouseIndex + orderIndex) % 3);
        const packageQtyB = 1 + ((warehouseIndex + orderIndex + 1) % 2);
        const baseQtyA = packageQtyA * uom.ratio;
        const baseQtyB = packageQtyB * uom.ratio;
        const totalPackageQty = packageQtyA + packageQtyB;
        const totalBaseQty = baseQtyA + baseQtyB;

        orders.push({
          transfer_no: transferNo,
          from_warehouse: fromWarehouse,
          to_warehouse: toWarehouse,
          reason: orderIndex === 0 ? "库存平衡" : orderIndex === 1 ? "仓库整理" : "生产调拨",
          status: "WAIT_PICK",
          material_count: 2,
          package_qty: totalPackageQty,
          base_qty: totalBaseQty,
          transfer_occupied_package_qty: totalPackageQty,
          transfer_occupied_base_qty: totalBaseQty,
          picked_package_qty: 0,
          picked_base_qty: 0,
          sent_package_qty: 0,
          sent_base_qty: 0,
          signed_package_qty: 0,
          signed_base_qty: 0,
          creator: "VM",
          create_time: `2026-05-${String(dayOffset).padStart(2, "0")} ${String(9 + (warehouseIndex % 4)).padStart(2, "0")}:${String(10 + orderIndex * 7).padStart(2, "0")}`,
          remark: `${fromWarehouse} 调拨至 ${toWarehouse}`,
        });

        details.push(
          {
            transfer_no: transferNo,
            material_category: category,
            spu_code: `SPU-${transferCodePrefixMap[bizType]}-${String(warehouseIndex * 10 + orderIndex + 1).padStart(4, "0")}`,
            sku_code: `SKU-${transferCodePrefixMap[bizType]}-${String(50001 + warehouseIndex * 20 + orderIndex * 2).padStart(5, "0")}`,
            package_code: `${transferNo}-A`,
            roll_no: uom.packageUnit === "卷" ? `ROLL-${String(serial).slice(-3)}A` : "",
            package_unit: uom.packageUnit,
            package_qty: packageQtyA,
            base_qty: baseQtyA,
            base_unit: uom.baseUnit,
            from_warehouse: fromWarehouse,
            from_area: "拣货区",
            from_location: `R01-${String(warehouseIndex + 1).padStart(2, "0")}-${String(orderIndex + 1).padStart(2, "0")}`,
            to_warehouse: toWarehouse,
            status: "TRANSFER_OCCUPIED",
          },
          {
            transfer_no: transferNo,
            material_category: category,
            spu_code: `SPU-${transferCodePrefixMap[bizType]}-${String(warehouseIndex * 10 + orderIndex + 101).padStart(4, "0")}`,
            sku_code: `SKU-${transferCodePrefixMap[bizType]}-${String(50101 + warehouseIndex * 20 + orderIndex * 2).padStart(5, "0")}`,
            package_code: `${transferNo}-B`,
            roll_no: uom.packageUnit === "卷" ? `ROLL-${String(serial).slice(-3)}B` : "",
            package_unit: uom.packageUnit,
            package_qty: packageQtyB,
            base_qty: baseQtyB,
            base_unit: uom.baseUnit,
            from_warehouse: fromWarehouse,
            from_area: "暂存区",
            from_location: `R01-${String(warehouseIndex + 1).padStart(2, "0")}-${String(orderIndex + 6).padStart(2, "0")}`,
            to_warehouse: toWarehouse,
            status: "TRANSFER_OCCUPIED",
          },
        );

        serial += 1;
        dayOffset = dayOffset >= 28 ? 10 : dayOffset + 1;
      }
    });
  });

  return { orders, details };
};

// ============================================================================
// Transfer-order derived seeds
// ============================================================================

const materialTransferSeed = buildMaterialTransferSeeds();
export const materialTransferDetailSeed: TransferOrderDetail[] = materialTransferSeed.details;
export const materialTransferOrderSeed: TransferOrder[] = materialTransferSeed.orders;

// ============================================================================
// Transfer status & category helpers
// ============================================================================

const toPdaMaterialTransferStatus = (status: TransferOrderStatus): PdaMaterialTransferStatus => {
  if (status === "WAIT_PICK") return "WAIT_PICK";
  if (status === "PICKING") return "PICKING";
  if (status === "WAIT_SEND") return "WAIT_SEND";
  if (status === "IN_TRANSIT") return "IN_TRANSIT";
  if (status === "WAIT_SIGN") return "WAIT_SIGN";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "EXCEPTION") return "EXCEPTION";
  return "WAIT_PICK";
};

const toMaterialCategoryName = (category: MaterialCategory): string => {
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

// ============================================================================
// PDA material-transfer order seed
// ============================================================================

export const pdaMaterialTransferOrderSeed: PdaMaterialTransferOrder[] = materialTransferOrderSeed.map((order) => {
  const lines: PdaMaterialTransferLine[] = materialTransferDetailSeed
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
});

/** Convert a TransferOrder + its details into a PdaMaterialTransferOrder. */
export const mapTransferOrderToPda = (order: TransferOrder, allDetails: TransferOrderDetail[]): PdaMaterialTransferOrder => {
  const lines: PdaMaterialTransferLine[] = allDetails
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

// ============================================================================
// PDA inbound order seed
// ============================================================================

export const pdaInboundOrderSeed: PdaInboundOrder[] = [
  {
    id: "PDA-IN-001",
    inboundOrderNo: "INB-PDA-0001",
    status: "待收货",
    allowOverReceive: false,
    lines: [
      { id: "PDA-IN-001-1", sku: "SKU-GC-20001", expectedQty: 30, receivedQty: 0 },
      { id: "PDA-IN-001-2", sku: "SKU-GC-20002", expectedQty: 12, receivedQty: 0 },
    ],
  },
  {
    id: "PDA-IN-002",
    inboundOrderNo: "INB-PDA-0002",
    status: "待收货",
    allowOverReceive: true,
    lines: [
      { id: "PDA-IN-002-1", sku: "SKU-GC-20003", expectedQty: 20, receivedQty: 0 },
      { id: "PDA-IN-002-2", sku: "SKU-GC-20001", expectedQty: 8, receivedQty: 0 },
    ],
  },
];

// ============================================================================
// PDA putaway task seed
// ============================================================================

export const pdaPutawayTaskSeed: PdaPutawayTask[] = [
  {
    id: "PDA-PA-001",
    taskNo: "PA-PDA-0001",
    inboundOrderNo: "RKD-PDA-0001",
    status: "待上架",
    allowedLocations: ["A-01", "A-02", "B-01"],
    lines: [
      { id: "PDA-PA-001-1", sku: "SKU-GC-20001", pendingQty: 24, putawayQty: 0 },
      { id: "PDA-PA-001-2", sku: "SKU-GC-20002", pendingQty: 10, putawayQty: 0 },
    ],
  },
  {
    id: "PDA-PA-002",
    taskNo: "PA-PDA-0002",
    inboundOrderNo: "RKD-PDA-0002",
    status: "待上架",
    allowedLocations: ["B-02", "C-01"],
    lines: [{ id: "PDA-PA-002-1", sku: "SKU-GC-20003", pendingQty: 12, putawayQty: 0 }],
  },
];

// ============================================================================
// PDA picking task seed
// ============================================================================

export const pdaPickingTaskSeed: PdaPickingTask[] = [
  {
    id: "PDA-PK-001",
    taskNo: "PK-PDA-0001",
    status: "待拣货",
    lines: [
      { id: "PDA-PK-001-1", sku: "SKU-GC-20001", location: "A-01", requiredQty: 6, pickedQty: 0 },
      { id: "PDA-PK-001-2", sku: "SKU-GC-20002", location: "B-01", requiredQty: 4, pickedQty: 0 },
    ],
  },
  {
    id: "PDA-PK-002",
    taskNo: "PK-PDA-0002",
    status: "待拣货",
    lines: [{ id: "PDA-PK-002-1", sku: "SKU-GC-20003", location: "B-02", requiredQty: 5, pickedQty: 0 }],
  },
];

// ============================================================================
// PDA outbound order seed
// ============================================================================

export const pdaOutboundOrderSeed: PdaOutboundOrder[] = [
  {
    id: "PDA-OUT-001",
    reviewOrderNo: "FH-TEST-0001",
    waybillNo: "WB2404150001",
    reviewed: true,
    status: "待发货",
  },
  {
    id: "PDA-OUT-002",
    reviewOrderNo: "FH-TEST-0002",
    waybillNo: "WB2404150002",
    reviewed: false,
    status: "待发货",
  },
];

// ============================================================================
// PDA inventory check task seed
// ============================================================================

export const pdaInventoryCheckTaskSeed: PdaInventoryCheckTask[] = [
  {
    checkNo: "PD-MAT-20260604-001",
    checkType: "MATERIAL",
    warehouseId: "WH-L1-FAB-001",
    warehouseName: "中央总仓-面料仓",
    warehouseType: "FABRIC",
    checkScope: "面辅料仓 / 指定SKU",
    countType: "SKU盘点",
    status: "WAIT_CHECK",
    totalCount: 3,
    checkedCount: 0,
    abnormalCount: 0,
    createTime: "2026-06-04 09:20",
    details: [
      {
        id: "PD-MAT-001-1",
        checkNo: "PD-MAT-20260604-001",
        checkType: "MATERIAL",
        warehouseId: "WH-L1-FAB-001",
        materialCategory: "FABRIC",
        spuCode: "SPU-FAB-1100",
        skuCode: "SKU-FAB-51000",
        warehouseName: "中央总仓-面料仓",
        areaName: "货架区",
        locationCode: "A-01",
        packageCode: "YRK-FAB-20260529-102-FAB51000-R-0008",
        rollNo: "ROLL-FAB-0008",
        packageUnit: "卷",
        baseUnit: "米",
        systemPackageQty: 1,
        systemBaseQty: 80,
        systemQty: 80,
        checkStatus: "WAIT_CHECK",
      },
      {
        id: "PD-MAT-001-2",
        checkNo: "PD-MAT-20260604-001",
        checkType: "MATERIAL",
        warehouseId: "WH-L1-FAB-001",
        materialCategory: "FABRIC",
        spuCode: "SPU-FAB-1201",
        skuCode: "SKU-FAB-52001",
        warehouseName: "中央总仓-面料仓",
        areaName: "货架区",
        locationCode: "B-02",
        packageCode: "YRK-FAB-20260529-202-FAB52001-R-0003",
        rollNo: "ROLL-FAB-0003",
        packageUnit: "卷",
        baseUnit: "米",
        systemPackageQty: 10,
        systemBaseQty: 1000,
        systemQty: 1000,
        checkStatus: "WAIT_CHECK",
      },
      {
        id: "PD-MAT-001-3",
        checkNo: "PD-MAT-20260604-001",
        checkType: "MATERIAL",
        warehouseId: "WH-L1-FAB-001",
        materialCategory: "FABRIC",
        spuCode: "SPU-FAB-1302",
        skuCode: "SKU-FAB-53002",
        warehouseName: "中央总仓-面料仓",
        areaName: "暂存区",
        locationCode: "C-01",
        packageCode: "YRK-FAB-20260529-303-FAB53002-R-0005",
        rollNo: "ROLL-FAB-0005",
        packageUnit: "卷",
        baseUnit: "米",
        systemPackageQty: 2,
        systemBaseQty: 120,
        systemQty: 120,
        checkStatus: "WAIT_CHECK",
      },
    ],
  },
  {
    checkNo: "PD-GMT-20260604-001",
    checkType: "GARMENT",
    warehouseId: "WH-L1-GMT-002",
    warehouseName: "成衣仓-深圳仓01",
    warehouseType: "FINISHED",
    checkScope: "成衣仓 / 指定SKU",
    countType: "SKU盘点",
    status: "WAIT_CHECK",
    totalCount: 3,
    checkedCount: 0,
    abnormalCount: 0,
    createTime: "2026-06-04 09:35",
    details: [
      {
        id: "PD-GMT-001-1",
        checkNo: "PD-GMT-20260604-001",
        checkType: "GARMENT",
        warehouseId: "WH-L1-GMT-002",
        spuCode: "SPU-GC-2000",
        skuCode: "SKU-GC-20001",
        productName: "基础圆领T恤",
        styleNo: "GC-TEE-001",
        color: "黑色",
        size: "M",
        barcode: "BC-GC-20001",
        tagCode: "TAG-GC-20001",
        warehouseName: "成衣仓-深圳仓01",
        areaName: "货架区",
        locationCode: "R-A-01",
        systemQty: 10,
        checkStatus: "WAIT_CHECK",
      },
      {
        id: "PD-GMT-001-2",
        checkNo: "PD-GMT-20260604-001",
        checkType: "GARMENT",
        warehouseId: "WH-L1-GMT-002",
        spuCode: "SPU-GC-2000",
        skuCode: "SKU-GC-20002",
        productName: "基础圆领T恤",
        styleNo: "GC-TEE-001",
        color: "白色",
        size: "L",
        barcode: "BC-GC-20002",
        tagCode: "TAG-GC-20002",
        warehouseName: "成衣仓-深圳仓01",
        areaName: "货架区",
        locationCode: "R-A-02",
        systemQty: 20,
        checkStatus: "WAIT_CHECK",
      },
      {
        id: "PD-GMT-001-3",
        checkNo: "PD-GMT-20260604-001",
        checkType: "GARMENT",
        warehouseId: "WH-L1-GMT-002",
        spuCode: "SPU-GC-2001",
        skuCode: "SKU-GC-20003",
        productName: "轻薄防晒外套",
        styleNo: "GC-JKT-002",
        color: "浅蓝",
        size: "S",
        barcode: "BC-GC-20003",
        tagCode: "TAG-GC-20003",
        warehouseName: "成衣仓-深圳仓01",
        areaName: "货架区",
        locationCode: "R-B-01",
        systemQty: 12,
        checkStatus: "WAIT_CHECK",
      },
    ],
  },
  {
    checkNo: "PD-GMT-20260604-002",
    checkType: "GARMENT",
    warehouseId: "WH-L1-GMT-003",
    warehouseName: "成衣仓-武汉仓01",
    warehouseType: "FINISHED",
    checkScope: "成衣仓 / 武汉SKU抽盘",
    countType: "SKU盘点",
    status: "WAIT_CHECK",
    totalCount: 1,
    checkedCount: 0,
    abnormalCount: 0,
    createTime: "2026-06-04 10:10",
    details: [
      {
        id: "PD-GMT-002-1",
        checkNo: "PD-GMT-20260604-002",
        checkType: "GARMENT",
        warehouseId: "WH-L1-GMT-003",
        spuCode: "SPU-GC-2002",
        skuCode: "SKU-GC-WH-001",
        productName: "武汉仓测试成衣",
        styleNo: "GC-WH-001",
        color: "灰色",
        size: "M",
        barcode: "BC-GC-WH-001",
        tagCode: "TAG-GC-WH-001",
        warehouseName: "成衣仓-武汉仓01",
        areaName: "货架区",
        locationCode: "R-WH-01",
        systemQty: 6,
        checkStatus: "WAIT_CHECK",
      },
    ],
  },
];

// ============================================================================
// Barcode rule seed
// ============================================================================

export const barcodeRuleSeed: BarcodeRule[] = [
  {
    id: "BR-SKU",
    ruleName: "商品SKU规则",
    objectType: "商品SKU",
    prefix: "SKU",
    dateFormat: "YYYYMM",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
  {
    id: "BR-RCV",
    ruleName: "收货单规则",
    objectType: "收货单",
    prefix: "RCV",
    dateFormat: "YYYYMMDD",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
  {
    id: "BR-PUT",
    ruleName: "上架单规则",
    objectType: "上架单",
    prefix: "PUT",
    dateFormat: "YYYYMMDD",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
  {
    id: "BR-PK",
    ruleName: "拣货单规则",
    objectType: "拣货单",
    prefix: "PK",
    dateFormat: "YYYYMMDD",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
  {
    id: "BR-OUT",
    ruleName: "出库单规则",
    objectType: "出库单",
    prefix: "OUT",
    dateFormat: "YYYYMMDD",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
  {
    id: "BR-MOV",
    ruleName: "移库单规则",
    objectType: "移库单",
    prefix: "MOV",
    dateFormat: "YYYYMMDD",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
  {
    id: "BR-TRF",
    ruleName: "移货单规则",
    objectType: "移货单",
    prefix: "TRF",
    dateFormat: "YYYYMMDD",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
  {
    id: "BR-ZL",
    ruleName: "库区库位规则",
    objectType: "库区库位",
    prefix: "ZL-",
    dateFormat: "NONE",
    serialLength: 4,
    isEnabled: true,
    createdAt: "2026-04-15 10:50",
    updatedAt: "2026-04-15 10:50",
  },
];

// ============================================================================
// Box code seed
// ============================================================================

export const boxCodeSeed: BoxCodeRecord[] = [
  { id: "BOX-001", boxCode: "BOX202604150001", sku: "SKU-GC-20001", quantity: 24, status: "未使用", createdAt: "2026-04-15 10:56" },
  { id: "BOX-002", boxCode: "BOX202604150002", sku: "SKU-GC-20003", quantity: 12, status: "已使用", createdAt: "2026-04-15 10:57" },
];

// ============================================================================
// Re-export id-generator helpers for convenience
// ============================================================================

export { makeMaterialTransferNo, createMaterialTransferDraft };

// ============================================================================
// Re-export warehouseTypeCodeMap for downstream consumers
// ============================================================================

export { warehouseTypeCodeMap };
