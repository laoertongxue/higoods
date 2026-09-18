import type { RouteRegistry } from './route-types'
import { appStore } from '../state/store'
import { renderFinishedDashboard } from '../pages/wls/finished/dashboard'
import { renderFinishedPreInbound } from '../pages/wls/finished/pre-inbound'
import { renderFinishedStockRealtime, renderRawStockRealtime, renderTransitStockRealtime } from '../pages/wls/finished/stock-realtime'
import { renderFinishedPreOutbound } from '../pages/wls/finished/pre-outbound'
import { renderFinishedOutboundOrders } from '../pages/wls/finished/outbound-orders'
import { renderFinishedWaveManage } from '../pages/wls/finished/wave-manage'
import { renderFinishedPutaway } from '../pages/wls/finished/putaway'
import { renderFinishedMultiItemPacking } from '../pages/wls/finished/multi-item-packing'
import { renderFinishedStockFlow } from '../pages/wls/finished/stock-flow'
import { renderFinishedStockLocation } from '../pages/wls/finished/stock-location'
import { renderFinishedStockTransfer } from '../pages/wls/finished/stock-transfer'
import { renderFinishedInventoryCount } from '../pages/wls/finished/inventory-count'
import { renderCollectionOrders } from '../pages/wls/finished/collection-orders'
import { renderCollectionPicking } from '../pages/wls/finished/collection-picking'
import { renderCollectionSorting } from '../pages/wls/finished/collection-sorting'
import { renderCollectionRemoval } from '../pages/wls/finished/collection-removal'
import { renderCollectionRecords } from '../pages/wls/finished/collection-records'
import { renderReturnOrders } from '../pages/wls/finished/return-orders'
import { renderReturnQuality } from '../pages/wls/finished/return-quality'
import { renderReturnInbound } from '../pages/wls/finished/return-inbound'
import { renderFinishedPda } from '../pages/wls/finished/pda'
import { renderFinishedPdaShipScan } from '../pages/wls/finished/pda-ship-scan'
import { renderShipScan } from '../pages/wls/finished/ship-scan'
import { renderSorterMachineConfig } from '../pages/wls/finished/sorter-machine-config'
import { renderSorterGateConfig } from '../pages/wls/finished/sorter-gate-config'
import { renderSorterRecords } from '../pages/wls/finished/sorter-records'
import { renderBasicWarehouse } from '../pages/wls/finished/basic-warehouse'
import { renderBasicSubject } from '../pages/wls/finished/basic-subject'
import { renderBasicZoneLocation } from '../pages/wls/finished/basic-zone-location'
import { renderBasicBasket } from '../pages/wls/finished/basic-basket'
import { renderBasicCollectionBox } from '../pages/wls/finished/basic-collection-box'
import { renderBasicBarcodeRule } from '../pages/wls/finished/basic-barcode-rule'
import { renderBasicLabelConfig } from '../pages/wls/finished/basic-label-config'
import { renderBasicProductCenter } from '../pages/wls/finished/basic-product-center'
import { renderBasicSupplier } from '../pages/wls/finished/basic-supplier'
import { renderBasicProcessor } from '../pages/wls/finished/basic-processor'
import { renderTransitDashboard } from '../pages/wls/transit/dashboard'
import { renderTransitOverview } from '../pages/wls/transit/overview'
import { renderTransitReceiveManage } from '../pages/wls/transit/receive-manage'
import { renderTransitInboundManage } from '../pages/wls/transit/inbound-manage'
import { renderTransitKitCenter } from '../pages/wls/transit/kit-center'
import { renderTransitAllocationManage } from '../pages/wls/transit/allocation-manage'
import { renderTransitPutawayManage } from '../pages/wls/transit/putaway-manage'
import { renderTransitWorkAreaManage } from '../pages/wls/transit/work-area-manage'
import { renderTransitOutboundManage } from '../pages/wls/transit/outbound-manage'
import { renderTransitLocation } from '../pages/wls/transit/location'
import { renderTransitWarehouseTransfer } from '../pages/wls/transit/warehouse-transfer'
import { renderTransitPda } from '../pages/wls/transit/pda'
import { renderRawDashboard } from '../pages/wls/raw/dashboard'
import { renderRawArrivalList } from '../pages/wls/raw/arrival-list'
import { renderRawInboundList } from '../pages/wls/raw/inbound-list'
import { renderRawRequisitionList } from '../pages/wls/raw/requisition-list'
import { renderRawIssueList } from '../pages/wls/raw/issue-list'
import { renderRawOutboundList } from '../pages/wls/raw/outbound-list'
import { renderRawStockLocation } from '../pages/wls/raw/stock-location'
import { renderRawStockFlow } from '../pages/wls/raw/stock-flow'
import { renderRawFabricInventoryCount } from '../pages/wls/raw/fabric-inventory-count'
import { renderRawAccessoryInventoryCount } from '../pages/wls/raw/accessory-inventory-count'
import { renderRawFabricTransfer } from '../pages/wls/raw/fabric-transfer'
import { renderRawAccessoryTransfer } from '../pages/wls/raw/accessory-transfer'
import { renderRawFabricScore } from '../pages/wls/raw/fabric-score'
import { renderRawPda } from '../pages/wls/raw/pda'

function placeholder(title: string) {
  return () => `<div class="flex min-h-[60vh] items-center justify-center"><div class="text-center"><p class="text-sm text-slate-400">页面迁移中</p><h2 class="mt-2 text-lg font-semibold text-slate-700">${title}</h2><p class="mt-1 text-xs text-slate-400">该页面正在从 Higood-wms 迁移至 WLS 模块</p></div></div>`
}

export const routes: RouteRegistry = {
  exactRoutes: {
    // ── 成衣仓 · 工作台 ──
    '/wls/finished/dashboard': () => renderFinishedDashboard(appStore.getState()),
    '/wls/finished/pda': () => renderFinishedPda(appStore.getState()),
    '/wls/finished/pda-ship-scan': () => renderFinishedPdaShipScan(appStore.getState()),
    '/wls/finished/ship-scan': () => renderShipScan(appStore.getState()),

    // ── 成衣仓 · 入库管理 ──
    '/wls/finished/pre-inbound': () => renderFinishedPreInbound(appStore.getState()),
    '/wls/finished/putaway': () => renderFinishedPutaway(appStore.getState()),
    '/wls/finished/return-orders': () => renderReturnOrders(appStore.getState()),
    '/wls/finished/return-quality': () => renderReturnQuality(appStore.getState()),
    '/wls/finished/return-inbound': () => renderReturnInbound(appStore.getState()),

    // ── 成衣仓 · 出库管理 ──
    '/wls/finished/pre-outbound': () => renderFinishedPreOutbound(appStore.getState()),
    '/wls/finished/outbound-orders': () => renderFinishedOutboundOrders(appStore.getState()),
    '/wls/finished/wave-manage': () => renderFinishedWaveManage(appStore.getState()),
    '/wls/finished/multi-item-packing': () => renderFinishedMultiItemPacking(appStore.getState()),

    // ── 成衣仓 · 集货管理 ──
    '/wls/finished/collection/orders': () => renderCollectionOrders(appStore.getState()),
    '/wls/finished/collection/picking': () => renderCollectionPicking(appStore.getState()),
    '/wls/finished/collection/sorting': () => renderCollectionSorting(appStore.getState()),
    '/wls/finished/collection/removal': () => renderCollectionRemoval(appStore.getState()),
    '/wls/finished/collection/records': () => renderCollectionRecords(appStore.getState()),

    // ── 成衣仓 · 库存管理 ──
    '/wls/finished/stock/realtime': () => renderFinishedStockRealtime(appStore.getState()),
    '/wls/finished/stock/location': () => renderFinishedStockLocation(appStore.getState()),
    '/wls/finished/stock/flow': () => renderFinishedStockFlow(appStore.getState()),
    '/wls/finished/stock/transfer': () => renderFinishedStockTransfer(appStore.getState()),
    '/wls/finished/stock/inventory-count': () => renderFinishedInventoryCount(appStore.getState()),

    // ── 成衣仓 · 智能分拣 ──
    '/wls/finished/sorter/machine-config': () => renderSorterMachineConfig(appStore.getState()),
    '/wls/finished/sorter/gate-config': () => renderSorterGateConfig(appStore.getState()),
    '/wls/finished/sorter/records': () => renderSorterRecords(appStore.getState()),

    // ── 成衣仓 · 基础管理 ──
    '/wls/finished/basic/warehouse': () => renderBasicWarehouse(appStore.getState()),
    '/wls/finished/basic/subject': () => renderBasicSubject(appStore.getState()),
    '/wls/finished/basic/zone-location': () => renderBasicZoneLocation(appStore.getState()),
    '/wls/finished/basic/basket': () => renderBasicBasket(appStore.getState()),
    '/wls/finished/basic/collection-box': () => renderBasicCollectionBox(appStore.getState()),
    '/wls/finished/basic/barcode-rule': () => renderBasicBarcodeRule(appStore.getState()),
    '/wls/finished/basic/label-config': () => renderBasicLabelConfig(appStore.getState()),
    '/wls/finished/basic/product-center': () => renderBasicProductCenter(appStore.getState()),

    // ── 中转仓 · 工作台 ──
    '/wls/transit/dashboard': () => renderTransitDashboard(appStore.getState()),
    '/wls/transit/overview': () => renderTransitOverview(appStore.getState()),
    '/wls/transit/pda': () => renderTransitPda(appStore.getState()),

    // ── 中转仓 · 作业 ──
    '/wls/transit/receive-manage': () => renderTransitReceiveManage(appStore.getState()),
    '/wls/transit/inbound-manage': () => renderTransitInboundManage(appStore.getState()),
    '/wls/transit/kit-center': () => renderTransitKitCenter(appStore.getState()),
    '/wls/transit/allocation-manage': () => renderTransitAllocationManage(appStore.getState()),
    '/wls/transit/putaway-manage': () => renderTransitPutawayManage(appStore.getState()),
    '/wls/transit/work-area-manage': () => renderTransitWorkAreaManage(appStore.getState()),
    '/wls/transit/outbound-manage': () => renderTransitOutboundManage(appStore.getState()),
    '/wls/transit/inventory': () => renderTransitStockRealtime(appStore.getState()),
    '/wls/transit/location': () => renderTransitLocation(appStore.getState()),
    '/wls/transit/warehouse-transfer': () => renderTransitWarehouseTransfer(appStore.getState()),

    // ── 中转仓 · 基础管理 ──
    '/wls/transit/basic/warehouse': () => renderBasicWarehouse(appStore.getState()),
    '/wls/transit/basic/subject': () => renderBasicSubject(appStore.getState()),
    '/wls/transit/basic/zone-location': () => renderBasicZoneLocation(appStore.getState()),
    '/wls/transit/basic/processor': () => renderBasicProcessor(appStore.getState()),
    '/wls/transit/basic/barcode-rule': () => renderBasicBarcodeRule(appStore.getState()),
    '/wls/transit/basic/label-config': () => renderBasicLabelConfig(appStore.getState()),

    // ── 原料仓 · 工作台 ──
    '/wls/raw/dashboard': () => renderRawDashboard(appStore.getState()),
    '/wls/raw/pda': () => renderRawPda(appStore.getState()),

    // ── 原料仓 · 入库 ──
    '/wls/raw/arrival-list': () => renderRawArrivalList(appStore.getState()),
    '/wls/raw/inbound-list': () => renderRawInboundList(appStore.getState()),

    // ── 原料仓 · 出库 ──
    '/wls/raw/requisition-list': () => renderRawRequisitionList(appStore.getState()),
    '/wls/raw/issue-list': () => renderRawIssueList(appStore.getState()),
    '/wls/raw/outbound-list': () => renderRawOutboundList(appStore.getState()),

    // ── 原料仓 · 库存管理 ──
    '/wls/raw/stock/realtime': () => renderRawStockRealtime(appStore.getState()),
    '/wls/raw/stock/location': () => renderRawStockLocation(appStore.getState()),
    '/wls/raw/stock/flow': () => renderRawStockFlow(appStore.getState()),
    '/wls/raw/stock/fabric-inventory-count': () => renderRawFabricInventoryCount(appStore.getState()),
    '/wls/raw/stock/accessory-inventory-count': () => renderRawAccessoryInventoryCount(appStore.getState()),
    '/wls/raw/stock/fabric-transfer': () => renderRawFabricTransfer(appStore.getState()),
    '/wls/raw/stock/accessory-transfer': () => renderRawAccessoryTransfer(appStore.getState()),

    // ── 原料仓 · 数据分析 ──
    '/wls/raw/fabric-score': () => renderRawFabricScore(appStore.getState()),

    // ── 原料仓 · 基础管理 ──
    '/wls/raw/basic/warehouse': () => renderBasicWarehouse(appStore.getState()),
    '/wls/raw/basic/subject': () => renderBasicSubject(appStore.getState()),
    '/wls/raw/basic/zone-location': () => renderBasicZoneLocation(appStore.getState()),
    '/wls/raw/basic/barcode-rule': () => renderBasicBarcodeRule(appStore.getState()),
    '/wls/raw/basic/label-config': () => renderBasicLabelConfig(appStore.getState()),
    '/wls/raw/basic/product-center': () => renderBasicProductCenter(appStore.getState()),
    '/wls/raw/basic/supplier': () => renderBasicSupplier(appStore.getState()),
    '/wls/raw/basic/processor': () => renderBasicProcessor(appStore.getState()),

    // ── 共享基础管理 ──
    '/wls/basic/warehouse': () => renderBasicWarehouse(appStore.getState()),
    '/wls/basic/subject': () => renderBasicSubject(appStore.getState()),
    '/wls/basic/zone-location': () => renderBasicZoneLocation(appStore.getState()),
    '/wls/basic/barcode-rule': () => renderBasicBarcodeRule(appStore.getState()),
    '/wls/basic/label-config': () => renderBasicLabelConfig(appStore.getState()),
    '/wls/basic/product-center': () => renderBasicProductCenter(appStore.getState()),
    '/wls/basic/supplier': () => renderBasicSupplier(appStore.getState()),
    '/wls/basic/processor': () => renderBasicProcessor(appStore.getState()),
  },
  dynamicRoutes: [],
}
