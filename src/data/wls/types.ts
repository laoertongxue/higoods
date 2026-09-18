// Auto-extracted from Higood-wms App.tsx — WLS domain types

// ---------------------------------------------------------------------------
// Navigation / Menu primitive types
// ---------------------------------------------------------------------------

export type WarehouseType = "自建" | "合作";
export type WarehouseBizType =
  | "FINISHED"
  | "RAW_MATERIAL"
  | "FABRIC"
  | "ACCESSORY"
  | "PACKAGING"
  | "YARN"
  | "CONSUMABLE"
  | "TRANSIT";
export type WarehouseSystemKey = "finished" | "transit" | "raw";

// ---------------------------------------------------------------------------
// Material template keys (used to derive composite menu keys)
// ---------------------------------------------------------------------------

export type MaterialTemplateKey =
  | "fabric"
  | "accessory"
  | "yarn"
  | "consumable"
  | "packaging"
  | "transit";

export type FinishedInventoryCountMenuKey =
  | "finishedRawInventoryCount"
  | "finishedRawInventoryCountDetail";

export type MaterialTemplateMenuKey =
  | `${MaterialTemplateKey}MaterialArrivalList`
  | `${MaterialTemplateKey}MaterialInboundList`
  | `${MaterialTemplateKey}MaterialRequisitionList`
  | `${MaterialTemplateKey}MaterialIssueList`
  | `${MaterialTemplateKey}MaterialOutboundList`
  | `${MaterialTemplateKey}RawInventoryCount`
  | `${MaterialTemplateKey}RawInventoryCountDetail`;

export type WarehouseTransferMenuKey =
  `${MaterialTemplateKey | "finished"}WarehouseTransfer`;

// ---------------------------------------------------------------------------
// MenuKey — SmartSorterPage & CollectionPage inlined from external modules
// ---------------------------------------------------------------------------

export type MenuKey =
  | "dashboard"
  | "warehouse"
  | "subject"
  | "zoneLocationManage"
  | "pdaOperation"
  | "pdaShipScan"
  | "shipScan"
  // SmartSorterPage (inlined from SmartSorterModule)
  | "sorterMachineConfig"
  | "sorterGateConfig"
  | "sorterRecords"
  | "barcodeRule"
  | "labelConfig"
  | "preInbound"
  | "materialArrivalList"
  | "materialInboundList"
  | "transitReceiveManage"
  | "transitOverview"
  | "transitInboundManage"
  | "transitKitCenter"
  | "transitAllocationManage"
  | "transitPutawayManage"
  | "transitWorkAreaManage"
  | "transitOutboundManage"
  | "transitInventoryManage"
  | "transitLocationManage"
  | "transitReturnList"
  | "transitInboundList"
  | "returnOrderList"
  | "returnReceiveDetail"
  | "returnQualityList"
  | "returnInboundList"
  | "preOutbound"
  | "materialRequisitionList"
  | "materialIssueList"
  | "materialOutboundList"
  | "transitMaterialList"
  | "transitIssueList"
  | "transitOutboundList"
  | "outboundOrderList"
  | "waveManage"
  | "waveDetail"
  | "basketManage"
  | "multiItemPacking"
  // CollectionPage (inlined from GarmentCollectionModule)
  | "collectionOrders"
  | "collectionPicking"
  | "collectionPda"
  | "collectionPdaSorting"
  | "collectionPdaRemoval"
  | "collectionSorting"
  | "collectionBoxMaster"
  | "collectionRemoval"
  | "collectionRecords"
  | "preInboundDetail"
  | "preOutboundDetail"
  | "putaway"
  | "stockRealtime"
  | "stockLocation"
  | "stockFlow"
  | "rawStockRealtime"
  | "rawStockLocation"
  | "rawStockFlow"
  | "transitStockRealtime"
  | "transitStockLocation"
  | "transitStockFlow"
  | "rawInventoryCount"
  | "rawInventoryCountDetail"
  | "stockTransfer"
  | "materialTransfer"
  | "fabricScore"
  | "productCenter"
  | FinishedInventoryCountMenuKey
  | MaterialTemplateMenuKey
  | WarehouseTransferMenuKey
  | "processorManage"
  | "supplier"
  | "warehouseManage"
  | "transitDashboard"
  | "transitPreInbound";

export type WarehouseNavigationSection = {
  title: string;
  items: Array<{ key: MenuKey; label: string; short: string }>;
};

// ---------------------------------------------------------------------------
// Simple union / enum-like types
// ---------------------------------------------------------------------------

export type SubjectType = "工厂" | "平台" | "公司";

export type InboundType =
  | "成衣入库"
  | "原料采购入库"
  | "中转回货入库"
  | "退货入库"
  | "仓库调拨"
  | "现货采购入库"
  | "工厂回货";

export type OutboundType =
  | "成衣销售出库"
  | "原料领料出库"
  | "中转配料出库"
  | "调拨出库"
  | "退货出库"
  | "预售出库"
  | "销售出库"
  | "仓库调拨";

export type InboundTypeCode =
  | "FINISHED_INBOUND"
  | "MATERIAL_PURCHASE_INBOUND"
  | "TRANSIT_RETURN_INBOUND"
  | "RETURN_INBOUND";

export type OutboundTypeCode =
  | "SALES_OUTBOUND"
  | "MATERIAL_REQUISITION_OUTBOUND"
  | "TRANSIT_MATERIAL_OUTBOUND"
  | "TRANSFER_OUTBOUND";

export type PutawayType = "标准上架" | "越库上架（虚拟）" | "调拨上架";
export type WorkMode = "single" | "standard";
export type ScanType =
  | "review_order"
  | "outbound_order"
  | "waybill"
  | "sku"
  | "box"
  | "location"
  | "order"
  | "unknown";
export type OperationSource = "WEB" | "PDA" | "AUTO";
export type UserRole = "管理员" | "仓库主管" | "仓库员";
export type PutawayStatus = "待上架" | "上架中" | "部分上架" | "上架完成";
export type PutawayMode = "手动上架";
export type PreInboundStatus = "待收货" | "收货中" | "部分收货" | "全部收货";
export type PreOutboundStatus =
  | "待处理"
  | "待拣货"
  | "拣货中"
  | "待出库"
  | "已出库"
  | "已取消";
export type OutboundOrderStatus =
  | "待复核"
  | "复核中"
  | "待出库"
  | "待打包"
  | "已出库"
  | "已取消";
export type ProductStatus = "成品" | "半成品" | "成衣（加工完成）";
export type ProductType = "FINISHED_GOODS" | "MATERIAL";
export type MaterialCategory =
  | "FABRIC"
  | "ACCESSORY"
  | "CONSUMABLE"
  | "PACKAGING"
  | "YARN";
export type ProductSyncStatus = "同步成功" | "同步中" | "同步失败";
export type ReturnQualityResult = "可售" | "瑕疵" | "报废";
export type FulfillmentMode =
  | "SINGLE_SCAN_SHIP"
  | "STANDARD_SHIP"
  | "STANDARD_REVIEW_SHIP";

export type ReturnOrderStatus =
  | "待收货"
  | "收货中"
  | "全部收货"
  | "待质检"
  | "质检中"
  | "待入库"
  | "待上架"
  | "入库中"
  | "部分上架"
  | "上架完成"
  | "异常待处理"
  | "已完成";

export type StockFlowDocType =
  | "收货单"
  | "上架单"
  | "拣货单"
  | "出库单"
  | "退货单"
  | "移货单"
  | "盘点单"
  | "调整单";

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

// ---------------------------------------------------------------------------
// Packaging unit helpers
// ---------------------------------------------------------------------------

export type PackagingUnitInput =
  | "箱"
  | "卷"
  | "亚"
  | "压"
  | "包"
  | "袋"
  | "KG"
  | "kg"
  | "X"
  | "R"
  | "Y"
  | "P"
  | "K";

// ---------------------------------------------------------------------------
// Transfer status enums
// ---------------------------------------------------------------------------

export type TransferOrderStatus =
  | "DRAFT"
  | "CANCELLED"
  | "WAIT_PICK"
  | "PICKING"
  | "WAIT_SEND"
  | "IN_TRANSIT"
  | "WAIT_SIGN"
  | "COMPLETED"
  | "EXCEPTION";

export type TransferPackageStatus =
  | "AVAILABLE"
  | "TRANSFER_OCCUPIED"
  | "TRANSFER_IN_TRANSIT"
  | "PENDING_PUTAWAY"
  | "EXCEPTION";

export type TransferReason =
  | "生产调拨"
  | "中转调拨"
  | "库存平衡"
  | "仓库整理"
  | "异常处理"
  | "其他";

export type TransferOperationType =
  | "SUBMIT_TRANSFER"
  | "PDA_PICK"
  | "CONFIRM_SEND"
  | "CONFIRM_RECEIVE"
  | "EXCEPTION_REGISTER";

// ---------------------------------------------------------------------------
// Material stock status enums
// ---------------------------------------------------------------------------

export type MaterialStockStatusCode =
  | "STOCK_SUFFICIENT"
  | "STOCK_PARTIAL_SUFFICIENT"
  | "STOCK_INSUFFICIENT";

export type FactoryConfirmStatusCode =
  | "NOT_REQUIRED"
  | "PENDING_CONFIRM"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED";

export type MaterialPickingStatusCode =
  | "DRAFT"
  | "WAIT_PICKING"
  | "PICKING"
  | "PICKING_DONE"
  | "WAIT_OUTBOUND"
  | "OUTBOUND_CREATED"
  | "OUTBOUND_DONE"
  | "COMPLETED"
  | "CANCELLED"
  | "SHORTAGE_PENDING_CONFIRM"
  | "FACTORY_REJECTED";

export type MaterialRequisitionStatusCode =
  | "WAIT_STOCK_CHECK"
  | "STOCK_CHECKED"
  | "PICKING_CREATED"
  | "PARTIAL_PICKING_CREATED"
  | "PICKING_DONE"
  | "PARTIAL_PICKING_DONE"
  | "PENDING_FACTORY_CONFIRM"
  | "FACTORY_CONFIRMED"
  | "FACTORY_REJECTED"
  | "OUTBOUND_CREATED"
  | "STOCK_INSUFFICIENT"
  | "CANCELLED";

export type MaterialStockLineJudgement =
  | "SUFFICIENT"
  | "PARTIAL_SUFFICIENT"
  | "INSUFFICIENT";

// ---------------------------------------------------------------------------
// Basket / wave enums
// ---------------------------------------------------------------------------

export type BasketStatus =
  | "IDLE"
  | "BOUND"
  | "PICKING"
  | "PICK_DONE"
  | "PACKING"
  | "RELEASED"
  | "DISABLED"
  | "EXCEPTION";

export type BasketBindingStatus =
  | "BOUND"
  | "PICKING"
  | "PICK_DONE"
  | "PACKING"
  | "PACKED"
  | "RELEASED"
  | "EXCEPTION";

export type BasketType = "普通篮" | "大篮" | "异常篮";

// ---------------------------------------------------------------------------
// Transit enums
// ---------------------------------------------------------------------------

export type TransitKitStatus =
  | "WAIT_KIT_CHECK"
  | "DIRECT_KITTED"
  | "COMBINABLE"
  | "NOT_KITTED"
  | "KITTED"
  | "PARTIAL_PICKED";

export type TransitReceiveStatus =
  | "NOT_RECEIVED"
  | "PART_RECEIVED"
  | "RECEIVED";

export type TransitPromptStatus =
  | "NONE"
  | "WAIT_KIT_CHECK"
  | "WAIT_ALLOCATION"
  | "MERGE_REQUIRED"
  | "WAIT_PUTAWAY"
  | "WAIT_PICKUP_LIST"
  | "WAIT_FACTORY_CONFIRM"
  | "WAIT_NOTICE"
  | "WAIT_OUTBOUND"
  | "PARTIAL_OUTBOUND"
  | "LOCATION_BIND_REQUIRED"
  | "COMPLETED"
  | "EXCEPTION";

export type TransitCutterType = "SELF" | "OUTSOURCED";
export type TransitProcessorType = "INTERNAL" | "OUTSOURCED";
export type TransitNotifyStatus = "NOT_NOTIFIED" | "NOTIFIED";
export type TransitPickupStatus =
  | "WAIT_PICKUP"
  | "NEED_PICKUP"
  | "NO_PICKUP"
  | "PICKED_UP";
export type TransitOutboundStatus = "NOT_OUTBOUND" | "OUTBOUND";
export type TransitLocationStatus =
  | "EMPTY"
  | "BOUND"
  | "PARTIAL_USED"
  | "RELEASED"
  | "DISABLED";
export type TransitNoticeType =
  | "KITTED_PICKUP_NOTICE"
  | "PARTIAL_ARRIVAL_NOTICE";
export type TransitAllocationStatus =
  | "NOT_CREATED"
  | "WAIT_PRINT"
  | "WAIT_PICKING"
  | "PICKING"
  | "WAIT_CLERK_CONFIRM"
  | "PICK_DONE"
  | "EXCEPTION";
export type TransitTaskType =
  | "DIRECT_KIT"
  | "COMBINED_KIT"
  | "NOT_KITTED_PUTAWAY";
export type TransitWorkAreaStatus =
  | "WORK_AREA_PENDING"
  | "READY_PICKUP"
  | "PUTAWAY_DONE"
  | "OUTBOUND_DONE"
  | "EXCEPTION_HOLD";
export type TransitPreInboundDisplayStatus =
  | "待收货"
  | "部分收货"
  | "已收货"
  | "已失效";
export type TransitProductionReceiveStatus =
  | "SHORTAGE"
  | "PARTIAL"
  | "COMPLETE";
export type TransitAllocationType = "FULL_RECEIPT" | "PARTIAL_RECEIPT";
export type TransitCutterReceiveStatus = "RECEIVED" | "NOT_RECEIVED";
export type TransitDashboardDatePreset =
  | "TODAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "CUSTOM";
export type TransitReceiveBoardFilter =
  | "PENDING_RECEIPTS"
  | "PENDING_RECEIPT"
  | "RECEIVING"
  | "PERIOD_RECEIVED"
  | "WAIT_PUTAWAY"
  | "WAIT_ALLOCATION"
  | "PERIOD_PUTAWAY"
  | "PERIOD_ALLOCATION";
export type TransitTaskListFilter =
  | "ALL"
  | "PENDING"
  | "COMPLETED"
  | "PERIOD_COMPLETED";
export type TransitTaskDetailKind = "ALLOCATION" | "PUTAWAY";
export type TransitTaskDetailMode = "VIEW" | "PRINT";
export type TransitPostReceiptTaskKind = "DIRECT" | "COMBINED" | "PUTAWAY";

// ---------------------------------------------------------------------------
// Barcode enums
// ---------------------------------------------------------------------------

export type BarcodeObjectType =
  | "商品SKU"
  | "收货单"
  | "上架单"
  | "拣货单"
  | "出库单"
  | "移库单"
  | "移货单"
  | "库区库位";

export type BarcodeRuleDateFormat = "YYYYMMDD" | "YYYYMM" | "NONE";

// ---------------------------------------------------------------------------
// PDA enums
// ---------------------------------------------------------------------------

export type PdaPage =
  | "home"
  | "warehouseSelect"
  | "myTasks"
  | "exceptionTasks"
  | "inbound"
  | "returnReceive"
  | "returnQuality"
  | "returnInbound"
  | "putaway"
  | "picking"
  | "collectionPicking"
  | "collectionSorting"
  | "collectionRemoval"
  | "multiBasketBind"
  | "relocate"
  | "inventoryCheck"
  | "materialTransferPda"
  | "shipping"
  | "shippingSingle";

export type PdaInboundStatus = "待收货" | "收货中" | "部分收货" | "已收货";
export type PdaPutawayStatus = "待上架" | "上架中" | "部分上架" | "已上架";
export type PdaPickingStatus = "待拣货" | "拣货中" | "部分拣货" | "拣货完成";
export type PdaShippingStatus = "待发货" | "发货中" | "已发货";
export type PdaScanObjectType =
  | "BOX"
  | "SKU"
  | "LOCATION"
  | "ORDER"
  | "EXCEPTION"
  | "UNKNOWN";
export type PdaMaterialTransferStatus =
  | "WAIT_PICK"
  | "PICKING"
  | "WAIT_SEND"
  | "IN_TRANSIT"
  | "WAIT_SIGN"
  | "COMPLETED"
  | "EXCEPTION";
export type PdaTransferModuleKey =
  | "transfer-pick"
  | "transfer-send"
  | "transfer-receive"
  | "transfer-exception";
export type PickingAreaGroupStatus = "待拣货" | "拣货中" | "已完成";
export type PdaInventoryCheckType = "MATERIAL" | "GARMENT";
export type PdaInventoryTaskStatus =
  | "WAIT_CHECK"
  | "CHECKING"
  | "SUBMITTED"
  | "WAIT_AUDIT"
  | "COMPLETED"
  | "CANCELLED";
export type PdaInventoryDetailStatus = "WAIT_CHECK" | "CHECKED" | "ABNORMAL";
export type PdaMyTaskFilter =
  | "all"
  | "pending"
  | "processing"
  | "partial"
  | "exception"
  | "completed";
export type PdaMyTaskType =
  | "收货"
  | "退货收货"
  | "入库/上架"
  | "退货上架"
  | "拣货"
  | "配料"
  | "复核"
  | "异常";
export type PdaMyTaskStatus =
  | "待作业"
  | "作业中"
  | "部分完成"
  | "已完成"
  | "异常";

export type PdaHomeRoute =
  | "/pda/inbound/standard"
  | "/pda/inbound/putaway"
  | "/pda/return/receive"
  | "/pda/return/qc"
  | "/pda/return/putaway"
  | "/pda/outbound/picking"
  | "/pda/collection/picking"
  | "/pda/collection/sorting"
  | "/pda/collection/removal"
  | "/pda/outbound/single-scan-ship"
  | "/pda/outbound/ship-scan"
  | "/pda/stock/move"
  | "/pda/inventory/check"
  | "/pda/transfer/material"
  | "/pda/transfer/material/pick"
  | "/pda/transfer/material/send"
  | "/pda/transfer/material/receive"
  | "/pda/transfer/material/exception"
  | "/pda/query/inventory"
  | "/pda/query/location-inventory"
  | "/pda/scan-log"
  | "/pda/query/open-logs";

export type MaterialInventoryStatus =
  | "正常"
  | "待上架"
  | "已上架"
  | "已占用"
  | "部分使用"
  | "已用完"
  | "冻结"
  | "异常";

// ---------------------------------------------------------------------------
// Pre-inbound detail UI types
// ---------------------------------------------------------------------------

export type PreInboundDetailSourceMenu =
  | "preInbound"
  | "materialArrivalList"
  | "transitReturnList";
export type PreInboundDetailMode = "view" | "receive";

// ===========================================================================
// Entity types — Layer 1 (no custom-type dependencies)
// ===========================================================================

export type ReturnOrder = {
  id: string;
  returnOrderNo: string;
  qualityOrderNo: string;
  inboundOrderNo: string;
  putawayOrderNo: string;
  relatedOrderNo: string;
  warehouseName: string;
  ownerName: string;
  spu: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  exceptionQuantity?: number;
  qualityResult: ReturnQualityResult | null;
  hasStain: boolean;
  hasDamage: boolean;
  hasWearTrace: boolean;
  tagIntact: boolean;
  qualityInspector: string;
  qualityCheckedCompleteQuantity: number;
  qualityCheckedDefectQuantity: number;
  qualityCheckedScrapQuantity: number;
  putawayQuantity: number;
  defectLocation: string;
  putawayLocation: string;
  operatorName: string;
  status: ReturnOrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseZone = {
  id: string;
  name: string;
  locations: string[];
  shelfEnabled?: boolean;
  shelfName?: string;
  shelfRowCount?: number;
  shelfColumnCount?: number;
  shelfConfigs?: Array<{
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
  }>;
};

export type Subject = {
  id: string;
  name: string;
  type: SubjectType;
  taxNo: string;
  bankAccount: string;
  contactName: string;
  phone: string;
};

export type SubjectForm = Subject;

export type PageTab = {
  key: MenuKey;
  label: string;
};

export type InboundLabelSkuRow = {
  id: string;
  spu: string;
  sku: string;
  baseUnit: string;
  packageUnit: string;
  packageQty: number;
  unitQty: number;
  totalQty: number;
  materialCategory?: MaterialCategory;
};

export type PackagingCodeHistoryItem =
  | string
  | {
      package_code?: string;
      old_package_code?: string;
      label_code?: string;
      material_type_code?: string;
      materialTypeCode?: string;
      inbound_no?: string;
      inboundNo?: string;
      sku_code?: string;
      skuCode?: string;
      package_unit?: string;
      packageUnit?: string;
      print_status?: string;
      printStatus?: string;
    };

export type GeneratedPackagingLabel = {
  label_code: string;
  package_code: string;
  old_package_code?: string;
  inbound_no: string;
  asn_no?: string;
  spu_code?: string;
  sku_code: string;
  material_category: string;
  material_type_code: string;
  supplier_name?: string;
  package_unit: PackagingUnitInput;
  base_unit: string;
  package_qty: number;
  base_qty: number;
  print_date?: string;
  print_status: "GENERATED_TEMP";
  print_count: number;
  is_reprint: boolean;
  receive_batch_no?: string;
};

export type GeneratePackagingLabelsParams = {
  inboundNo: string;
  asnNo?: string;
  spuCode?: string;
  skuCode: string;
  materialCategory?: MaterialCategory | "OTHER" | string | null;
  supplierName?: string;
  packageUnit: PackagingUnitInput;
  baseUnit: string;
  currentReceivePackageQty: number;
  currentReceiveBaseQty: number;
  receivedPackageQty?: number;
  existingLabels?: PackagingCodeHistoryItem[];
  receiveBatchNo?: string;
  printDate?: string;
};

export type GenerateShortPackageCodesParams = {
  materialCategory?: MaterialCategory | "OTHER" | string | null;
  printDate: string | Date;
  generateQty: number;
  existingPackageLabels: PackagingCodeHistoryItem[];
};

export type PutawayPackageDetail = {
  putaway_no: string;
  inbound_no: string;
  package_code: string;
  spu_code: string;
  sku_code: string;
  package_unit: string;
  package_qty: number;
  base_qty: number;
  base_unit: string;
  target_area_code: string;
  target_location_code: string;
  operator: string;
  operate_time: string;
};

// ---------------------------------------------------------------------------
// Transfer entities
// ---------------------------------------------------------------------------

export type TransferOrder = {
  transfer_no: string;
  from_warehouse: string;
  to_warehouse: string;
  reason: TransferReason;
  status: TransferOrderStatus;
  material_count: number;
  package_qty: number;
  base_qty: number;
  transfer_package_qty?: number;
  transfer_base_qty?: number;
  picked_package_qty?: number;
  picked_base_qty?: number;
  sent_package_qty?: number;
  sent_base_qty?: number;
  signed_package_qty?: number;
  signed_base_qty?: number;
  received_package_qty?: number;
  received_base_qty?: number;
  putaway_package_qty?: number;
  putaway_base_qty?: number;
  transfer_occupied_package_qty: number;
  transfer_occupied_base_qty: number;
  creator: string;
  create_time: string;
  remark: string;
};

export type TransferOrderDetail = {
  transfer_no: string;
  material_category: MaterialCategory;
  spu_code: string;
  sku_code: string;
  material_name?: string;
  package_code: string;
  roll_no: string;
  package_unit: string;
  package_qty: number;
  base_qty: number;
  transfer_package_qty?: number;
  transfer_base_qty?: number;
  picked_package_qty?: number;
  picked_base_qty?: number;
  sent_package_qty?: number;
  sent_base_qty?: number;
  signed_package_qty?: number;
  signed_base_qty?: number;
  received_package_qty?: number;
  received_base_qty?: number;
  putaway_package_qty?: number;
  putaway_base_qty?: number;
  base_unit: string;
  from_warehouse: string;
  from_area: string;
  from_location: string;
  to_warehouse: string;
  status: TransferPackageStatus;
};

export type TransferStockSnapshot = {
  transfer_no: string;
  sku_code: string;
  package_code: string;
  roll_no: string;
  from_warehouse: string;
  from_location: string;
  before_available_base_qty: number;
  transfer_base_qty: number;
  after_available_base_qty: number;
  before_transfer_occupied_base_qty: number;
  after_transfer_occupied_base_qty: number;
  operate_time: string;
};

export type TransferExceptionRecord = {
  id: string;
  transfer_no: string;
  exception_type: string;
  package_code: string;
  exception_qty: number;
  remark: string;
  operator: string;
  operate_time: string;
};

export type TransferAllocatedUnit = {
  transfer_no: string;
  package_code: string;
  roll_no: string;
  sku_code: string;
  package_unit: string;
  package_qty: number;
  base_qty: number;
  base_unit: string;
  from_warehouse: string;
  from_location: string;
  to_warehouse: string;
  status: TransferPackageStatus;
};

export type TransferOperationLog = {
  transfer_no: string;
  operation_type: TransferOperationType;
  operator: string;
  operate_time: string;
  package_qty: number;
  base_qty: number;
  remark: string;
};

export type MaterialTransferDraft = {
  transfer_no: string;
  from_warehouse: string;
  to_warehouse: string;
  reason: TransferReason;
  remark: string;
  selectedPackageCodes: string[];
  lines?: Array<{ sku_code: string; transfer_package_qty: number }>;
};

// ---------------------------------------------------------------------------
// Putaway entities
// ---------------------------------------------------------------------------

export type PutawayOrderLine = {
  spuCode: string;
  skuCode: string;
  inboundQuantity: number;
  putawayQuantity?: number;
  sourceLocation?: string;
  targetLocation?: string;
};

export type PutawayOrder = {
  orderNo: string;
  inboundOrderNo?: string;
  paNo: string;
  relatedReceiptNo: string;
  relatedOrderNo?: string;
  putawayType: PutawayType;
  status: PutawayStatus;
  inboundQuantity: number;
  putawayMode: PutawayMode;
  spuCode: string;
  skuCode: string;
  batchNo: string;
  sourceLocation: string;
  targetLocation: string;
  putawayQuantity: number;
  receivedTime?: string;
  putawayTime?: string;
  itemLines?: PutawayOrderLine[];
  operatorName: string;
};

// ---------------------------------------------------------------------------
// Packaging unit (full entity)
// ---------------------------------------------------------------------------

export type PackagingUnit = {
  package_code: string;
  old_package_code?: string;
  material_type_code?: string;
  inbound_no: string;
  asn_no?: string;
  related_no: string;
  spu_code: string;
  sku_code: string;
  sku_name: string;
  material_category: MaterialCategory;
  package_unit: string;
  package_qty: number;
  base_qty: number;
  base_unit: string;
  supplier_name: string;
  warehouse_id?: string;
  warehouse_name: string;
  area_code: string;
  location_code: string;
  status:
    | "RECEIVED_NOT_CONFIRMED"
    | "PENDING_PUTAWAY"
    | "PUTAWAY_DONE"
    | "AVAILABLE"
    | "TRANSFER_OCCUPIED"
    | "TRANSFER_IN_TRANSIT"
    | "EXCEPTION";
  print_status:
    | "UNPRINTED"
    | "PRINTED"
    | "REPRINTED"
    | "WAIT_REPRINT"
    | "NOT_PRINTED";
  print_time?: string;
  print_user?: string;
  print_date?: string;
  print_count?: number;
  is_reprint?: boolean;
  receive_batch_no?: string;
  receive_time?: string;
  created_at?: string;
};

// ===========================================================================
// Entity types — Layer 2 (depend on Layer-0 enums + PackagingUnit)
// ===========================================================================

export type PreInboundOrder = {
  id: string;
  warehouse_id?: string;
  warehouse_name?: string;
  warehouse_type?: WarehouseBizType;
  inboundOrderNo: string;
  relatedOrderNo: string;
  inbound_type?: InboundTypeCode;
  inboundType: InboundType;
  trackingNo: string;
  inboundWarehouse: string;
  productItems: {
    id: string;
    spu: string;
    sku: string;
    materialCategory?: MaterialCategory;
    unit?: string;
    package_qty?: number;
    package_unit?: "包" | "卷" | "箱" | "袋";
    base_qty?: number;
    base_unit?: "颗" | "米" | "个" | "kg";
    received_package_qty?: number;
    received_base_qty?: number;
    current_package_qty?: number;
    current_base_qty?: number;
    quantity_per_package?: number;
    putaway_package_qty?: number;
    putaway_base_qty?: number;
    pending_putaway_package_qty?: number;
    pending_putaway_base_qty?: number;
    current_putaway_package_qty?: number;
    current_putaway_base_qty?: number;
    target_location_code?: string;
    roll_details?: Array<{
      roll_no: string;
      length: number;
      unit: "米";
      status?: "PENDING_PUTAWAY" | "PUTAWAY_DONE" | "FULL_ROLL";
      location_code?: string;
      target_location_code?: string;
      selected?: boolean;
    }>;
    productStatus: ProductStatus;
    deliveryQuantity: number;
    receivedQuantity: number;
  }[];
  packaging_units?: PackagingUnit[];
  deliveryUnit: string;
  deliveryQuantity: number;
  receivedQuantity: number;
  ownerName: string;
  operatorName: string;
  status: PreInboundStatus;
  shippingTime: string;
  receivedTime?: string;
  putawayTime?: string;
};

export type PreInboundPackageUnit = NonNullable<
  PreInboundOrder["productItems"][number]["package_unit"]
>;
export type PreInboundBaseUnit = NonNullable<
  PreInboundOrder["productItems"][number]["base_unit"]
>;

// ---------------------------------------------------------------------------
// Warehouse (depends on WarehouseType, WarehouseBizType, WarehouseZone)
// ---------------------------------------------------------------------------

export type Warehouse = {
  code: string;
  name: string;
  type: WarehouseType;
  businessType?: WarehouseBizType;
  ownerIds: string[];
  contact: string;
  locationCount: number;
  country: string;
  timezone: string;
  enabled: boolean;
  address: string;
  manager: string;
  settlement: string;
  zones: WarehouseZone[];
};

// ===========================================================================
// Entity types — Layer 3 (PreOutboundOrder & material stock)
// ===========================================================================

export type PreOutboundOrder = {
  id: string;
  warehouse_id?: string;
  warehouse_name?: string;
  warehouse_type?: WarehouseBizType;
  outboundOrderNo: string;
  reviewOrderNo: string;
  pickOrderNo: string;
  relatedOrderNo: string;
  outbound_type?: OutboundTypeCode;
  outboundType: OutboundType;
  trackingNo: string;
  outboundWarehouse: string;
  productItems: {
    id: string;
    spu: string;
    sku: string;
    materialCategory?: MaterialCategory;
    unit?: string;
    materialName?: string;
    isRequired?: boolean;
    availableStock?: number;
    fulfillRate?: number;
    plannedPickQuantity?: number;
    suggestedPickingQuantity?: number;
    stockJudgement?: MaterialStockLineJudgement;
    productStatus: ProductStatus;
    outboundQuantity: number;
    shippedQuantity: number;
    pickedQuantity: number;
    reviewedQuantity: number;
    allocatedLocation?: string;
  }[];
  receivingUnit: string;
  requisitionMethod?: "工厂到仓自提" | "仓库配送到厂";
  outboundQuantity: number;
  shippedQuantity: number;
  reviewedQuantity: number;
  waybillPrintCount: number;
  ownerName: string;
  operatorName: string;
  stockStatus: "库存充足" | "库存部分充足" | "库存不足";
  stock_status?: MaterialStockStatusCode;
  factory_confirm_status?: FactoryConfirmStatusCode;
  picking_status?: MaterialPickingStatusCode;
  requisition_status?: MaterialRequisitionStatusCode;
  available_ratio?: number;
  need_factory_confirm?: boolean;
  is_pda_visible?: boolean;
  planned_pick_qty?: number;
  actual_pick_qty?: number;
  reservation_status?:
    | "DRAFT_RESERVED"
    | "RESERVED"
    | "RELEASED"
    | "NONE";
  confirmed_at?: string;
  cancelled_at?: string;
  sku_count?: number;
  item_total_qty?: number;
  order_item_type?: "SINGLE_SKU" | "MULTI_SKU";
  pay_time?: string;
  ship_deadline_time?: string;
  created_at?: string;
  outbound_no?: string;
  order_no?: string;
  wave_no?: string;
  picking_task_no?: string;
  basket_code?: string;
  basket_bind_status?: BasketBindingStatus;
  basket_bind_time?: string;
  basket_bind_operator?: string;
  multi_item_pick_status?:
    | "WAIT_BIND"
    | "BOUND"
    | "PICKING"
    | "PICK_DONE"
    | "PACKING"
    | "RELEASED"
    | "EXCEPTION";
  factoryCallbackPayload?: FactoryMaterialPickingCallback;
  status: PreOutboundStatus;
  outboundOrderStatus: OutboundOrderStatus;
  orderTime: string;
  pickTime?: string;
  printTime?: string;
  create_time?: string;
  pick_time?: string;
  outbound_time?: string;
  fulfillmentMode?: FulfillmentMode;
  needReview?: boolean;
  stockDeducted?: boolean;
  stockDeductedTime?: string;
  stockDeductedSource?: string;
  isLocked?: boolean;
  lockedBy?: string;
  lockedTime?: string;
};

export type MaterialStockCheckLine = {
  id: string;
  sku: string;
  materialName?: string;
  isRequired: boolean;
  requiredQty: number;
  availableStock: number;
  fulfillRate: number;
  suggestedPickingQuantity: number;
  stockJudgement: MaterialStockLineJudgement;
  unit?: string;
};

export type MaterialStockCheckResult = {
  stock_status: MaterialStockStatusCode;
  stockStatus: PreOutboundOrder["stockStatus"];
  factory_confirm_status: FactoryConfirmStatusCode;
  picking_status: MaterialPickingStatusCode;
  requisition_status: MaterialRequisitionStatusCode;
  available_ratio: number;
  need_factory_confirm: boolean;
  lines: MaterialStockCheckLine[];
};

export type FactoryMaterialPickingCallback = {
  requisition_no: string;
  factory_order_no: string;
  stock_status: MaterialStockStatusCode;
  available_ratio: number;
  picking_no: string;
  picking_status: MaterialPickingStatusCode;
  factory_confirm_status: FactoryConfirmStatusCode;
  material_lines: Array<{
    sku_code: string;
    required_qty: number;
    planned_pick_qty: number;
    actual_pick_qty: number;
    unit?: string;
    fulfill_rate: number;
  }>;
  need_factory_confirm: boolean;
  callback_time: string;
};

// ===========================================================================
// Wave / basket entities
// ===========================================================================

export type OutboundOperationLog = {
  id: string;
  orderNo: string;
  reviewOrderNo: string;
  source: OperationSource;
  action:
    | "复核"
    | "打印面单"
    | "单件扫码发货"
    | "确认发货"
    | "自动打包机发货"
    | "Web打印面单/确认发货";
  operator: string;
  operatedAt: string;
  remark: string;
};

export type PickingAreaGroupDetail = {
  group_id: string;
  wave_no: string;
  outbound_no: string;
  spu_code: string;
  sku_code: string;
  product_name: string;
  plan_qty: number;
  picked_qty: number;
  area_name: string;
  location_code: string;
};

export type PickingAreaGroup = {
  group_id: string;
  wave_no: string;
  area_name: string;
  area_code: string;
  sku_count: number;
  plan_qty: number;
  picked_qty: number;
  status: PickingAreaGroupStatus;
  details: PickingAreaGroupDetail[];
};

export type GeneratedWaveRecord = {
  id: string;
  waveNo: string;
  warehouseName: string;
  orderIds: string[];
  operatorName: string;
  createdAt: string;
  wave_type?: "SINGLE_SKU" | "MULTI_ITEM_BASKET";
  basket_enabled?: boolean;
  enable_area_group?: boolean;
  picking_area_groups?: PickingAreaGroup[];
};

export type PickingBasket = {
  basket_code: string;
  basket_qr_code: string;
  basket_name: string;
  basket_type: BasketType;
  warehouse_name: string;
  status: BasketStatus;
  current_wave_no?: string;
  current_outbound_no?: string;
  current_order_no?: string;
  current_picking_task_no?: string;
  last_bind_time?: string;
  last_release_time?: string;
  remark?: string;
};

export type OutboundBasketBinding = {
  binding_id: string;
  wave_no: string;
  picking_task_no?: string;
  outbound_no: string;
  order_no: string;
  basket_code: string;
  basket_qr_code: string;
  binding_status: BasketBindingStatus;
  bind_time: string;
  release_time?: string;
  operator: string;
};

export type BasketOperationLog = {
  id: string;
  basket_code: string;
  wave_no?: string;
  picking_task_no?: string;
  outbound_no?: string;
  operation_type:
    | "BIND"
    | "PICK_START"
    | "PUT_SKU"
    | "PICK_DONE"
    | "PACK_START"
    | "PACK_DONE"
    | "RELEASE"
    | "DISABLE"
    | "ENABLE";
  operator: string;
  operated_at: string;
  remark: string;
};

export type MultiItemPickingAllocation = {
  allocation_id: string;
  wave_no: string;
  picking_task_no?: string;
  outbound_no: string;
  order_no: string;
  basket_code: string;
  sku_code: string;
  spu_code: string;
  product_name: string;
  location_code: string;
  required_qty: number;
  picked_qty: number;
  allocation_status: "待投放" | "部分投放" | "已投放";
};

// ===========================================================================
// Transit entities
// ===========================================================================

export type TransitMaterialLine = {
  sku: string;
  name: string;
  image_url?: string;
  detail_status?: "ACTIVE" | "VOIDED";
  expected_roll_count?: number;
  required_qty: number;
  delivery_qty?: number;
  received_qty: number;
  receive_remark?: string;
  outbound_qty?: number;
  work_area_qty?: number;
  allocated_qty?: number;
  putaway_qty?: number;
  exception_qty?: number;
  recommended_location?: string;
  task_shelf_picks?: Array<{
    location_code: string;
    quantity: number;
  }>;
  task_missing_qty?: number;
  task_putaway_qty?: number;
  kit_complete?: boolean;
  roll_count: number;
};

export type TransitProcessOrder = {
  receive_no: string;
  receive_document_status?: "ACTIVE" | "VOIDED";
  inbound_no: string;
  pre_inbound_document_status?: "ACTIVE" | "VOIDED";
  production_order_no: string;
  source: "印花厂" | "染色厂" | "异地中央仓" | "其他";
  expected_roll_count: number;
  received_roll_count: number;
  material_category_count: number;
  kit_status: TransitKitStatus;
  receive_status: TransitReceiveStatus;
  prompt_status: TransitPromptStatus;
  allocation_status?: TransitAllocationStatus;
  production_receive_status?: TransitProductionReceiveStatus;
  allocation_type?: TransitAllocationType;
  cutter_receive_status?: TransitCutterReceiveStatus;
  task_type?: TransitTaskType;
  task_no?: string;
  task_status?: "ACTIVE" | "VOIDED";
  task_recommended_location?: string;
  kit_check_time?: string;
  task_generated_time?: string;
  pickup_list_no?: string;
  outbound_no?: string;
  work_area_status?: TransitWorkAreaStatus;
  work_area_cleared?: boolean;
  stamp_confirmed?: boolean;
  task_completed_by?: string;
  task_completed_time?: string;
  arrival_time: string;
  receive_complete_time?: string;
  inbound_create_time?: string;
  cutter_type: TransitCutterType;
  cutter_name: string;
  processor_type: TransitProcessorType;
  processor_name: string;
  is_internal_factory: boolean;
  allow_partial_notice: boolean;
  allow_partial_outbound: boolean;
  notice_type?: TransitNoticeType;
  notify_status: TransitNotifyStatus;
  notice_operator?: string;
  notice_time?: string;
  notice_remark?: string;
  pickup_status: TransitPickupStatus;
  outbound_status: TransitOutboundStatus;
  priority_cut_confirmed?: boolean;
  priority_cut_remark?: string;
  partial_outbound_confirm_status?: "UNCONFIRMED" | "CONFIRMED";
  partial_outbound_confirm_operator?: string;
  partial_outbound_confirm_time?: string;
  partial_outbound_confirm_remark?: string;
  partial_outbound_material_detail?: string;
  missing_material_detail?: string;
  materials: TransitMaterialLine[];
};

export type TransitLocationBinding = {
  location_code: string;
  bind_production_order_no?: string;
  location_bind_status: TransitLocationStatus;
  material_sku?: string;
  material_name?: string;
  material_qty: number;
  roll_count: number;
  source_order_no?: string;
  bind_time?: string;
  release_time?: string;
};

export type TransitKitLog = {
  log_id: string;
  production_order_no: string;
  receive_order_no: string;
  check_time: string;
  check_result: TransitKitStatus;
  current_received_material: string;
  bound_location_material: string;
  missing_material: string;
  matched_location: string;
  operator: string;
  remark: string;
};

export type TransitTaskDetailState = {
  receiveNo: string;
  inboundNo: string;
  kind: TransitTaskDetailKind;
  mode: TransitTaskDetailMode;
};

export type TransitTaskPrintLog = {
  logId: string;
  receiveNo: string;
  inboundNo: string;
  kind: TransitTaskDetailKind;
  taskNos: string[];
  operator: string;
  printTime: string;
  printCount: number;
  status: "SUCCESS" | "FAILED";
};

export type TransitTaskPrintAllocationRow = {
  image: string;
  productionOrderNo: string;
  processorType: string;
  processorName: string;
  kitType: string;
  sku: string;
  materialName: string;
  receivedQty: number;
  requiredQty: number;
  unit: string;
  recommendedLocation: string;
};

export type TransitTaskPrintPutawayRow = {
  image: string;
  productionOrderNo: string;
  processorType: string;
  processorName: string;
  sku: string;
  materialName: string;
  receivedQty: number;
  putawayQty: number;
  unit: string;
  kitStatus: string;
  recommendedLocation: string;
};

export type TransitTaskPrintSnapshot = {
  receiveNo: string;
  inboundNo: string;
  kind: TransitTaskDetailKind;
  title: string;
  taskNos: string[];
  productionNos: string[];
  kitStatus: string;
  generatedTime: string;
  printTime: string;
  operator: string;
  processorSummary: string;
  allocationRows: TransitTaskPrintAllocationRow[];
  putawayRows: TransitTaskPrintPutawayRow[];
};

export type TransitTaskA4PreviewState = {
  snapshot: TransitTaskPrintSnapshot;
};

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

export type TransitReceiptPrintPreviewState = {
  documents: TransitReceiptPrintDocument[];
};

export type TransitReceiptPrintLog = {
  logId: string;
  receiveNo: string;
  operator: string;
  printTime: string;
  printCount: number;
  status: "SUCCESS" | "FAILED";
};

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
  expectedKitQty: number;
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

export type TransitPostReceiptTaskPrintPreviewState = {
  documents: TransitPostReceiptTaskPrintDocument[];
};

export type TransitPostReceiptTaskPrintLog = {
  logId: string;
  receiveNo: string;
  taskNos: string[];
  operator: string;
  printTime: string;
  printCount: number;
  status: "SUCCESS" | "FAILED";
};

export type TransitBatchReceiveDraftValue = {
  quantity: string;
  remark: string;
};

export type TransitBatchReceiveLine = {
  draftKey: string;
  image: string;
  sku: string;
  materialName: string;
  unit: string;
  requiredQty: number;
  deliveryQty: number;
  receivedQty: number;
  remainingQty: number;
};

export type TransitBatchReceiveGroup = {
  groupKey: string;
  inboundNo: string;
  productionNo: string;
  processorType: string;
  processorName: string;
  isVoided: boolean;
  lines: TransitBatchReceiveLine[];
};

export type TransitBatchReceiveLog = {
  logId: string;
  idempotencyKey: string;
  receiveNo: string;
  inboundNo: string;
  productionNo: string;
  sku: string;
  beforeQty: number;
  currentQty: number;
  afterQty: number;
  remark: string;
  operator: string;
  operatedAt: string;
};

export type TransitBatchReceivePayloadItem = {
  draftKey: string;
  inboundNo: string;
  productionNo: string;
  sku: string;
  quantity: number;
  remark: string;
  remainingQty: number;
};

export type TransitBatchReceiveConfirmState = {
  receiveNo: string;
  inboundCount: number;
  skuCount: number;
  totalQty: number;
  idempotencyKey: string;
};

// ===========================================================================
// Product / fabric types
// ===========================================================================

export type WaveGenerateFailureLog = {
  id: string;
  orderId: string;
  outboundOrderNo: string;
  warehouseName: string;
  reason: "库存不够";
  createdAt: string;
};

export type FabricScoreReason = {
  reason: string;
  ratio: string;
};

export type FabricProductItem = {
  id: string;
  image: string;
  spu: string;
  productName: string;
  styleCode: string;
  salesCount: number;
  score: number;
  totalBadReviewCount: number;
  badReviewCount: number;
  reasonCounts: {
    reason: string;
    count: number;
  }[];
};

export type FabricScoreItem = {
  id: string;
  image: string;
  spu: string;
  fabricName: string;
  details: FabricProductItem[];
};

export type ProductItem = {
  id: string;
  image: string;
  productName: string;
  spu: string;
  sku: string;
  productType: ProductType;
  materialCategory: MaterialCategory | null;
  unit: string;
  packageUnit: "卷" | "压" | "包" | "箱";
  sourceSystem: string;
  syncTime: string;
  status: ProductSyncStatus;
  specs: Record<string, string>;
};

export type ProductCenterFilters = {
  spu: string;
  sku: string;
  name: string;
  productType: ProductType;
  materialCategory: "全部" | MaterialCategory;
  unit: "全部" | string;
  status: "全部" | ProductSyncStatus;
};

export type SupplierItem = {
  code: string;
  name: string;
  contactName: string;
  phone: string;
};

export type ProcessorPartner = {
  code: string;
  name: string;
  processorType: TransitProcessorType;
  pickupRule: "ALLOW_PARTIAL" | "KIT_ONLY";
  contactName: string;
  phone: string;
  address: string;
  status: "ENABLED" | "DISABLED";
  remark: string;
};

// ===========================================================================
// Barcode entities
// ===========================================================================

export type BarcodeRule = {
  id: string;
  ruleName: string;
  objectType: BarcodeObjectType;
  prefix: string;
  dateFormat: BarcodeRuleDateFormat;
  serialLength: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BarcodeRuleFilters = {
  objectType: "全部" | BarcodeObjectType;
  ruleName: string;
  status: "全部" | "启用" | "停用";
};

export type BarcodePrefixRecognitionResult = {
  objectType: BarcodeObjectType | "未知";
  matchedPrefix: string;
  routeHint: string;
  message: string;
};

export type BoxCodeRecord = {
  id: string;
  boxCode: string;
  sku: string;
  quantity: number;
  status: "未使用" | "已使用";
  createdAt: string;
};

// ===========================================================================
// PDA entities
// ===========================================================================

export type PdaQtyMeta = {
  packageUnit?: string;
  baseUnit?: string;
  basePerPackage?: number;
};

export type PdaScanQty = Required<PdaQtyMeta> & {
  packageQty: number;
  baseQty: number;
};

export type PdaTransferModule = {
  key: PdaTransferModuleKey;
  title: string;
  task_count: number;
  allowed_statuses: PdaMaterialTransferStatus[];
  icon: string;
  action_text: string;
};

export type PdaInboundOrder = {
  id: string;
  inboundOrderNo: string;
  status: PdaInboundStatus;
  allowOverReceive: boolean;
  lines: Array<
    {
      id: string;
      sku: string;
      expectedQty: number;
      receivedQty: number;
    } & PdaQtyMeta
  >;
};

export type PdaInboundLabelPreviewRow = {
  id: string;
  lineId: string;
  materialCategory?: MaterialCategory | null;
  spu: string;
  sku: string;
  packageUnit: string;
  baseUnit: string;
  packageQty: number;
  baseQty: number;
  labelCount: number;
  unitBaseQty: number;
  packagingCodes: string[];
  historyLabelCount: number;
  historyMaxSequence: number;
  sequenceRange: string;
  printStatus:
    | "NOT_GENERATED"
    | "GENERATED"
    | "PRINTED"
    | "NOT_PRINTED"
    | "WAIT_REPRINT"
    | "REPRINTED";
  printCount: number;
};

export type PdaPutawayTask = {
  id: string;
  taskNo: string;
  inboundOrderNo: string;
  status: PdaPutawayStatus;
  allowedLocations: string[];
  lines: Array<
    {
      id: string;
      sku: string;
      pendingQty: number;
      putawayQty: number;
    } & PdaQtyMeta
  >;
};

export type PdaPickingTask = {
  id: string;
  taskNo: string;
  sourceWarehouse?: string;
  sourceOrderIds?: string[];
  status: PdaPickingStatus;
  enableAreaGroup?: boolean;
  areaGroups?: PickingAreaGroup[];
  lines: Array<
    {
      id: string;
      sku: string;
      location: string;
      areaName?: string;
      areaCode?: string;
      requiredQty: number;
      pickedQty: number;
    } & PdaQtyMeta
  >;
};

export type PdaOutboundOrder = {
  id: string;
  reviewOrderNo: string;
  waybillNo: string;
  reviewed: boolean;
  status: PdaShippingStatus;
  shippedAt?: string;
};

export type PdaMaterialTransferLine = {
  id: string;
  materialCategory: MaterialCategory;
  spu: string;
  sku: string;
  productName: string;
  packageUnit: string;
  baseUnit: string;
  qty: number;
  baseQty: number;
  availableQty: number;
  availableBaseQty: number;
};

export type PdaMaterialTransferOrder = {
  transferNo: string;
  fromWarehouse: string;
  toWarehouse: string;
  status: PdaMaterialTransferStatus;
  creator: string;
  createdAt: string;
  remark: string;
  lines: PdaMaterialTransferLine[];
};

export type PdaScanLog = {
  id: string;
  module:
    | "收货"
    | "质检"
    | "上架"
    | "拣货"
    | "配料"
    | "移库"
    | "发货"
    | "盘点";
  taskNo: string;
  scanCode: string;
  resolvedType: PdaScanObjectType;
  resolvedRef: string;
  success: boolean;
  message: string;
  operator: string;
  scannedAt: string;
  workMode?: WorkMode;
  scanType?: ScanType;
  bizNo?: string;
  skuCode?: string;
  locationCode?: string;
  qcResult?: ReturnQualityResult;
  errorMessage?: string;
};

export type PdaNotice = {
  type: "success" | "error" | "warning";
  text: string;
};

export type WarehouseInfo = {
  warehouseName: string;
  userName: string;
  date: string;
};

export type PDAWorkContext = {
  userId: string;
  operatorName: string;
  roleType: UserRole;
  availableWarehouses: Warehouse[];
  currentWarehouseId: string;
  currentWarehouseName: string;
  currentWarehouseType: WarehouseBizType | "";
  currentInventoryMode: PdaInventoryCheckType;
};

export type TaskStats = {
  pending: number;
  processing: number;
  completedToday: number;
  exception: number;
};

export type PdaMyTaskItem = {
  id: string;
  taskNo: string;
  taskType: PdaMyTaskType;
  relatedNo: string;
  status: PdaMyTaskStatus;
  expectedQty: number;
  doneQty: number;
  progress: number;
  deadline?: string;
  urgent?: boolean;
  warehouseName: string;
  assignedToCurrentUser: boolean;
  updatedAt?: string;
};

export type PdaMenuItem = {
  key: string;
  title: string;
  icon: string;
  taskCount: number;
  route: PdaHomeRoute;
  transferModuleKey?: PdaTransferModuleKey;
};

export type PdaMenuGroup = {
  key: "inbound" | "outbound" | "stock" | "transfer" | "query";
  title: string;
  items: PdaMenuItem[];
  collapsed: boolean;
};

export type ScanLog = {
  scanCode: string;
  workType: string;
  result: "成功" | "失败";
  time: string;
};

export type PdaResolvedScan = {
  type: PdaScanObjectType;
  code: string;
  refId?: string;
  sku?: string;
  quantity?: number;
  baseQty?: number;
  boxStatus?: BoxCodeRecord["status"];
};

export type PdaInventoryCheckDetail = {
  id: string;
  checkNo: string;
  checkType: PdaInventoryCheckType;
  warehouseId: string;
  spuCode: string;
  skuCode: string;
  warehouseName: string;
  areaName: string;
  locationCode: string;
  systemQty: number;
  actualQty?: number;
  diffQty?: number;
  checkStatus: PdaInventoryDetailStatus;
  abnormalFlag?: boolean;
  remark?: string;
  materialCategory?: MaterialCategory;
  packageCode?: string;
  rollNo?: string;
  packageUnit?: string;
  baseUnit?: string;
  systemPackageQty?: number;
  systemBaseQty?: number;
  actualPackageQty?: number;
  actualBaseQty?: number;
  packageDiffQty?: number;
  baseDiffQty?: number;
  productName?: string;
  styleNo?: string;
  color?: string;
  size?: string;
  barcode?: string;
  tagCode?: string;
};

export type PdaInventoryCheckTask = {
  checkNo: string;
  checkType: PdaInventoryCheckType;
  warehouseId: string;
  warehouseName: string;
  warehouseType: WarehouseBizType;
  checkScope: string;
  countType: string;
  status: PdaInventoryTaskStatus;
  totalCount: number;
  checkedCount: number;
  abnormalCount: number;
  createTime: string;
  details: PdaInventoryCheckDetail[];
};

export type PdaInventoryCheckException = {
  id: string;
  checkNo: string;
  checkType: PdaInventoryCheckType;
  packageCode?: string;
  rollNo?: string;
  barcode?: string;
  tagCode?: string;
  skuCode: string;
  exceptionType: string;
  locationCode: string;
  remark: string;
  operator: string;
  operateTime: string;
};

// ===========================================================================
// Stock / inventory entities
// ===========================================================================

export type StockRealtimeItem = {
  id: string;
  image: string;
  productName: string;
  spu: string;
  sku: string;
  warehouse_id?: string;
  warehouseName: string;
  warehouse_type?: WarehouseBizType;
  material_category?: MaterialCategory | null;
  unit?: string;
  spotStock: number;
  transitStock: number;
  pendingPutawayStock?: number;
  pendingShipmentQuantity: number;
  preSaleOrderOccupiedQuantity: number;
  spotOrderOccupiedQuantity: number;
  pendingReturnQualityQuantity: number;
  defectiveStock: number;
  damagedStock: number;
};

export type MaterialInventorySummary = {
  id: string;
  material_category: MaterialCategory;
  material_name: string;
  spu_code: string;
  sku_code: string;
  warehouse_name: string;
  area_name: string;
  location_code: string;
  package_qty: number;
  package_unit: string;
  base_qty: number;
  base_unit: string;
  available_package_qty: number;
  available_base_qty: number;
  requisition_occupied_package_qty: number;
  requisition_occupied_base_qty: number;
  pending_putaway_package_qty: number;
  pending_putaway_base_qty: number;
  package_unit_count: number;
  supplier_name: string;
  batch_no: string;
  stock_status: MaterialInventoryStatus;
};

export type PackagingUnitDetail = {
  package_code: string;
  inbound_no: string;
  spu_code: string;
  sku_code: string;
  material_category: MaterialCategory;
  package_unit: string;
  package_qty: number;
  base_qty: number;
  base_unit: string;
  warehouse_name: string;
  area_name: string;
  location_code: string;
  supplier_name: string;
  batch_no: string;
  occupied_status: "未占用" | "已占用";
  stock_status: MaterialInventoryStatus;
};

export type FabricRollDetail = {
  roll_no: string;
  sku_code: string;
  package_code: string;
  original_length: number;
  used_length: number;
  remaining_length: number;
  unit: string;
  warehouse_name: string;
  area_name: string;
  location_code: string;
  supplier_name: string;
  batch_no: string;
  inbound_no: string;
  occupied_status: "未占用" | "已占用";
  stock_status: MaterialInventoryStatus;
};

export type StockLocationRow = {
  id: string;
  warehouse_id?: string;
  warehouse_type?: WarehouseBizType;
  warehouseName: string;
  warehouseZone: string;
  warehouseLocation: string;
  spu: string;
  sku: string;
  material_category?: MaterialCategory | null;
  unit?: string;
  quantity: number;
  updatedAt: string;
};

export type LocationStockChange = {
  warehouseName: string;
  warehouseZone: string;
  warehouseLocation: string;
  spu: string;
  sku: string;
  quantityDelta: number;
};

export type StockTransferRecord = {
  id: string;
  transferNo: string;
  sourceWarehouse: string;
  sourceZone: string;
  sourceLocation: string;
  targetWarehouse: string;
  targetZone: string;
  targetLocation: string;
  spu: string;
  sku: string;
  quantity: number;
  lines: Array<{ spu: string; sku: string; quantity: number }>;
  createdTime: string;
  status: "待执行" | "移货中" | "已完成";
};

export type StockFlowRecord = {
  id: string;
  warehouse_id?: string;
  warehouse_type?: WarehouseBizType;
  businessNo: string;
  flowType: "入库" | "上架" | "库内调拨" | "拣货" | "出库";
  docType?: StockFlowDocType;
  actionType?: StockFlowActionType;
  inbound_type?: InboundTypeCode;
  outbound_type?: OutboundTypeCode;
  material_category?: MaterialCategory | null;
  unit?: string;
  warehouseName?: string;
  sourceWarehouse: string;
  sourceLocation: string;
  targetWarehouse: string;
  targetLocation: string;
  spu: string;
  sku: string;
  productName?: string;
  quantity: number;
  qtyChange?: number;
  beforeQty?: number;
  afterQty?: number;
  totalSnapshot?: number;
  availableSnapshot?: number;
  lockedSnapshot?: number;
  inTransitSnapshot?: number;
  totalStockChange?: number;
  totalStockBefore?: number;
  totalStockAfter?: number;
  spotStockChange?: number;
  spotStockBefore?: number;
  spotStockAfter?: number;
  transitStockChange?: number;
  transitStockBefore?: number;
  transitStockAfter?: number;
  pendingReturnQualityChange?: number;
  pendingReturnQualityBefore?: number;
  pendingReturnQualityAfter?: number;
  defectiveStockChange?: number;
  defectiveStockBefore?: number;
  defectiveStockAfter?: number;
  damagedStockChange?: number;
  damagedStockBefore?: number;
  damagedStockAfter?: number;
  preSaleOccupiedChange?: number;
  preSaleOccupiedBefore?: number;
  preSaleOccupiedAfter?: number;
  spotOrderOccupiedChange?: number;
  spotOrderOccupiedBefore?: number;
  spotOrderOccupiedAfter?: number;
  availableStockChange?: number;
  availableStockBefore?: number;
  availableStockAfter?: number;
  locationCode?: string;
  operatorName?: string;
  operateTime?: string;
  operator: string;
  operationTime: string;
  remark: string;
};

// ===========================================================================
// Material template config
// ===========================================================================

export type MaterialTemplateConfig = {
  key: MaterialTemplateKey;
  label: string;
  short: string;
  businessType: WarehouseBizType;
  inboundType: InboundTypeCode;
  outboundType: OutboundTypeCode;
};
