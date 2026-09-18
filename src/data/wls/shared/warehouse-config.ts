// Auto-extracted from Higood-wms App.tsx — warehouse configuration utilities

import type {
  WarehouseBizType,
  WarehouseSystemKey,
  MenuKey,
  MaterialCategory,
  InboundTypeCode,
  OutboundTypeCode,
  TransferOrderStatus,
  PreOutboundOrder,
  MaterialStockStatusCode,
  FactoryConfirmStatusCode,
  MaterialPickingStatusCode,
  MaterialRequisitionStatusCode,
  MaterialStockLineJudgement,
  WarehouseNavigationSection,
} from "../types";

// ── Warehouse system configuration ──

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
      { key: "stockRealtime", label: "实时库存", short: "实" },
      { key: "stockLocation", label: "库位库存", short: "库" },
      { key: "stockTransfer", label: "移货管理", short: "移" },
      { key: "stockFlow", label: "库存流水", short: "流" },
    ] },
    { title: "基础数据", items: [
      { key: "warehouseManage", label: "仓库管理", short: "仓" },
      { key: "productCenter", label: "商品中心", short: "商" },
      { key: "supplier", label: "供应商管理", short: "供" },
      { key: "processorManage", label: "加工方管理", short: "加" },
    ] },
  ],
  transit: [
    { title: "工作台", items: [
      { key: "transitDashboard", label: "中转仓看板", short: "看" },
    ] },
    { title: "收货管理", items: [
      { key: "transitPreInbound", label: "中转收货", short: "收" },
    ] },
    { title: "基础数据", items: [
      { key: "warehouseManage", label: "仓库管理", short: "仓" },
      { key: "productCenter", label: "商品中心", short: "商" },
      { key: "supplier", label: "供应商管理", short: "供" },
      { key: "processorManage", label: "加工方管理", short: "加" },
    ] },
  ],
  raw: [
    { title: "工作台", items: [
      { key: "dashboard", label: "原料仓首页", short: "首" },
    ] },
    { title: "基础数据", items: [
      { key: "warehouseManage", label: "仓库管理", short: "仓" },
      { key: "productCenter", label: "物料中心", short: "料" },
      { key: "supplier", label: "供应商管理", short: "供" },
      { key: "processorManage", label: "加工方管理", short: "加" },
    ] },
  ],
};

// ── Warehouse type code maps ──

export const warehouseTypeCodeMap: Record<WarehouseBizType, string> = {
  FINISHED: "GMT",
  RAW_MATERIAL: "FAB",
  FABRIC: "FAB",
  ACCESSORY: "TRM",
  PACKAGING: "PKG",
  YARN: "YRN",
  CONSUMABLE: "CON",
  TRANSIT: "TSF",
};

export const warehouseCodePrefixMap: Record<WarehouseBizType, string> = {
  FINISHED: "GMT",
  RAW_MATERIAL: "FAB",
  FABRIC: "FAB",
  ACCESSORY: "TRM",
  YARN: "YRN",
  CONSUMABLE: "CON",
  PACKAGING: "PKG",
  TRANSIT: "TSF",
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

export const materialCategoryLabelMap: Record<MaterialCategory, string> = {
  FABRIC: "面料",
  ACCESSORY: "辅料",
  CONSUMABLE: "耗材",
  PACKAGING: "包材",
  YARN: "纱线",
};

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

// ── Status label maps ──

export const MATERIAL_STOCK_STATUS_LABEL: Record<MaterialStockStatusCode, PreOutboundOrder["stockStatus"]> = {
  STOCK_SUFFICIENT: "库存充足",
  STOCK_PARTIAL_SUFFICIENT: "库存部分充足",
  STOCK_INSUFFICIENT: "库存不足",
};

export const FACTORY_CONFIRM_STATUS_LABEL: Record<FactoryConfirmStatusCode, string> = {
  NOT_REQUIRED: "无需确认",
  PENDING_CONFIRM: "待工厂确认",
  CONFIRMED: "工厂确认领取",
  REJECTED: "工厂拒绝领取",
  CANCELLED: "已取消",
};

export const MATERIAL_PICKING_STATUS_LABEL: Record<MaterialPickingStatusCode, string> = {
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

export const REQUISITION_STATUS_LABEL: Record<MaterialRequisitionStatusCode, string> = {
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

export const STOCK_LINE_JUDGEMENT_LABEL: Record<MaterialStockLineJudgement, string> = {
  SUFFICIENT: "库存充足",
  PARTIAL_SUFFICIENT: "部分充足",
  INSUFFICIENT: "库存不足",
};

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

export const transitProductionReceiveStatusLabel: Record<string, string> = {
  SHORTAGE: "缺货",
  PARTIAL: "未收齐",
  COMPLETE: "已收齐",
};

// ── Material template configuration ──

export type MaterialTemplateKey = "fabric" | "accessory" | "yarn" | "consumable" | "packaging" | "transit";

export type MaterialTemplateConfig = {
  key: MaterialTemplateKey;
  label: string;
  short: string;
  businessType: WarehouseBizType;
  inboundType: InboundTypeCode;
  outboundType: OutboundTypeCode;
};

export const materialTemplateConfigs: MaterialTemplateConfig[] = [
  { key: "fabric", label: "面料", short: "面", businessType: "FABRIC", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "accessory", label: "辅料", short: "辅", businessType: "ACCESSORY", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "yarn", label: "纱线", short: "纱", businessType: "YARN", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "consumable", label: "耗材", short: "耗", businessType: "CONSUMABLE", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "packaging", label: "包材", short: "包", businessType: "PACKAGING", inboundType: "MATERIAL_PURCHASE_INBOUND", outboundType: "MATERIAL_REQUISITION_OUTBOUND" },
  { key: "transit", label: "中转", short: "转", businessType: "TRANSIT", inboundType: "TRANSIT_RETURN_INBOUND", outboundType: "TRANSIT_MATERIAL_OUTBOUND" },
];

// ── Stock flow constants ──

export type StockFlowDocType = "收货单" | "上架单" | "拣货单" | "出库单" | "退货单" | "移货单" | "盘点单" | "调整单";

export type StockFlowActionType =
  | "成衣入库"
  | "原料采购入库"
  | "中转回货入库"
  | "退货入库"
  | "成衣销售出库"
  | "原料领料出库"
  | "中转配料出库"
  | "调拨出库"
  | "调拨入库"
  | "上架"
  | "移库"
  | "库存调整"
  | "收货入库"
  | "上架入库"
  | "锁定库存"
  | "释放锁定"
  | "销售出库"
  | "移货"
  | "盘盈"
  | "盘亏"
  | "手工调整";

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

// ── Country/timezone data ──

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

// ── Transfer configuration ──

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

// ── Misc constants ──

export const MATERIAL_STOCK_PARTIAL_THRESHOLD = 0.3;

export const INTEGER_MATERIAL_UNITS = new Set(["件", "颗", "个", "条", "粒", "枚", "PCS", "pc", "pcs"]);

export const FABRIC_RATIO_COLOR_TIP = "字段值颜色规则：超过50%标记红色；超过30%标记橙色；30%及以下标记绿色";

export const PAGE_SIZE = 20;
