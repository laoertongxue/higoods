// WLS 列表页事件分发。页面模块已随 routes-wls 在渲染时加载，
// 这里静态引用不会增加首屏成本；未注册的路径返回 false，交给通用外壳处理。
import { handleBasicBarcodeRuleEvent } from '../pages/wls/finished/basic-barcode-rule.ts'
import { handleBasicBasketEvent } from '../pages/wls/finished/basic-basket.ts'
import { handleBasicCollectionBoxEvent } from '../pages/wls/finished/basic-collection-box.ts'
import { handleBasicLabelConfigEvent } from '../pages/wls/finished/basic-label-config.ts'
import { handleBasicProcessorEvent } from '../pages/wls/finished/basic-processor.ts'
import { handleBasicProductCenterEvent } from '../pages/wls/finished/basic-product-center.ts'
import { handleBasicSubjectEvent } from '../pages/wls/finished/basic-subject.ts'
import { handleBasicSupplierEvent } from '../pages/wls/finished/basic-supplier.ts'
import { handleBasicWarehouseEvent } from '../pages/wls/finished/basic-warehouse.ts'
import { handleBasicZoneLocationEvent } from '../pages/wls/finished/basic-zone-location.ts'
import { handleCollectionOrdersEvent } from '../pages/wls/finished/collection-orders.ts'
import { handleCollectionPickingEvent } from '../pages/wls/finished/collection-picking.ts'
import { handleCollectionRecordsEvent } from '../pages/wls/finished/collection-records.ts'
import { handleCollectionRemovalEvent } from '../pages/wls/finished/collection-removal.ts'
import { handleCollectionSortingEvent } from '../pages/wls/finished/collection-sorting.ts'
import { handleFinishedInventoryCountEvent } from '../pages/wls/finished/inventory-count.ts'
import { handleFinishedOutboundOrdersEvent } from '../pages/wls/finished/outbound-orders.ts'
import { handleFinishedPreInboundEvent } from '../pages/wls/finished/pre-inbound.ts'
import { handleFinishedPreOutboundEvent } from '../pages/wls/finished/pre-outbound.ts'
import { handleFinishedPutawayEvent } from '../pages/wls/finished/putaway.ts'
import { handleFinishedStockLocationEvent } from '../pages/wls/finished/stock-location.ts'
import { handleRawAccessoryInventoryCountEvent } from '../pages/wls/raw/accessory-inventory-count.ts'
import { handleRawAccessoryTransferEvent } from '../pages/wls/raw/accessory-transfer.ts'
import { handleRawArrivalListEvent } from '../pages/wls/raw/arrival-list.ts'
import { handleRawFabricInventoryCountEvent } from '../pages/wls/raw/fabric-inventory-count.ts'
import { handleRawFabricScoreEvent } from '../pages/wls/raw/fabric-score.ts'
import { handleRawFabricTransferEvent } from '../pages/wls/raw/fabric-transfer.ts'
import { handleRawInboundListEvent } from '../pages/wls/raw/inbound-list.ts'
import { handleRawIssueListEvent } from '../pages/wls/raw/issue-list.ts'
import { handleRawOutboundListEvent } from '../pages/wls/raw/outbound-list.ts'
import { handleRawRequisitionListEvent } from '../pages/wls/raw/requisition-list.ts'
import { handleRawStockFlowEvent } from '../pages/wls/raw/stock-flow.ts'
import { handleRawStockLocationEvent } from '../pages/wls/raw/stock-location.ts'
import { handleReturnInboundEvent } from '../pages/wls/finished/return-inbound.ts'
import { handleReturnOrdersEvent } from '../pages/wls/finished/return-orders.ts'
import { handleReturnQualityEvent } from '../pages/wls/finished/return-quality.ts'
import { handleShipScanEvent } from '../pages/wls/finished/ship-scan.ts'
import { handleSorterGateConfigEvent } from '../pages/wls/finished/sorter-gate-config.ts'
import { handleSorterMachineConfigEvent } from '../pages/wls/finished/sorter-machine-config.ts'
import { handleSorterRecordsEvent } from '../pages/wls/finished/sorter-records.ts'
import { handleStockFlowEvent } from '../pages/wls/finished/stock-flow.ts'
import { handleStockRealtimeEvent } from '../pages/wls/finished/stock-realtime.ts'
import { handleStockTransferEvent } from '../pages/wls/finished/stock-transfer.ts'
import { handleTransitAllocationManageEvent } from '../pages/wls/transit/allocation-manage.ts'
import { handleTransitInboundManageEvent } from '../pages/wls/transit/inbound-manage.ts'
import { handleTransitKitCenterEvent } from '../pages/wls/transit/kit-center.ts'
import { handleTransitLocationEvent } from '../pages/wls/transit/location.ts'
import { handleTransitOutboundManageEvent } from '../pages/wls/transit/outbound-manage.ts'
import { handleTransitPutawayManageEvent } from '../pages/wls/transit/putaway-manage.ts'
import { handleTransitReceiveManageEvent } from '../pages/wls/transit/receive-manage.ts'
import { handleTransitWarehouseTransferEvent } from '../pages/wls/transit/warehouse-transfer.ts'
import { handleTransitWorkAreaManageEvent } from '../pages/wls/transit/work-area-manage.ts'
import { handleWaveManageEvent } from '../pages/wls/finished/wave-manage.ts'

type WlsPageEventHandler = (target: HTMLElement, event?: Event) => boolean

const pageEventHandlers: Record<string, WlsPageEventHandler> = {
  '/wls/basic/barcode-rule': handleBasicBarcodeRuleEvent,
  '/wls/basic/label-config': handleBasicLabelConfigEvent,
  '/wls/basic/processor': handleBasicProcessorEvent,
  '/wls/basic/product-center': handleBasicProductCenterEvent,
  '/wls/basic/subject': handleBasicSubjectEvent,
  '/wls/basic/supplier': handleBasicSupplierEvent,
  '/wls/basic/warehouse': handleBasicWarehouseEvent,
  '/wls/basic/zone-location': handleBasicZoneLocationEvent,
  '/wls/finished/basic/barcode-rule': handleBasicBarcodeRuleEvent,
  '/wls/finished/basic/basket': handleBasicBasketEvent,
  '/wls/finished/basic/collection-box': handleBasicCollectionBoxEvent,
  '/wls/finished/basic/label-config': handleBasicLabelConfigEvent,
  '/wls/finished/basic/product-center': handleBasicProductCenterEvent,
  '/wls/finished/basic/subject': handleBasicSubjectEvent,
  '/wls/finished/basic/warehouse': handleBasicWarehouseEvent,
  '/wls/finished/basic/zone-location': handleBasicZoneLocationEvent,
  '/wls/finished/collection/orders': handleCollectionOrdersEvent,
  '/wls/finished/collection/picking': handleCollectionPickingEvent,
  '/wls/finished/collection/records': handleCollectionRecordsEvent,
  '/wls/finished/collection/removal': handleCollectionRemovalEvent,
  '/wls/finished/collection/sorting': handleCollectionSortingEvent,
  '/wls/finished/outbound-orders': handleFinishedOutboundOrdersEvent,
  '/wls/finished/pre-inbound': handleFinishedPreInboundEvent,
  '/wls/finished/pre-outbound': handleFinishedPreOutboundEvent,
  '/wls/finished/putaway': handleFinishedPutawayEvent,
  '/wls/finished/return-inbound': handleReturnInboundEvent,
  '/wls/finished/return-orders': handleReturnOrdersEvent,
  '/wls/finished/return-quality': handleReturnQualityEvent,
  '/wls/finished/ship-scan': handleShipScanEvent,
  '/wls/finished/sorter/gate-config': handleSorterGateConfigEvent,
  '/wls/finished/sorter/machine-config': handleSorterMachineConfigEvent,
  '/wls/finished/sorter/records': handleSorterRecordsEvent,
  '/wls/finished/stock/flow': handleStockFlowEvent,
  '/wls/finished/stock/inventory-count': handleFinishedInventoryCountEvent,
  '/wls/finished/stock/location': handleFinishedStockLocationEvent,
  '/wls/finished/stock/realtime': handleStockRealtimeEvent,
  '/wls/finished/stock/transfer': handleStockTransferEvent,
  '/wls/finished/wave-manage': handleWaveManageEvent,
  '/wls/raw/arrival-list': handleRawArrivalListEvent,
  '/wls/raw/basic/barcode-rule': handleBasicBarcodeRuleEvent,
  '/wls/raw/basic/label-config': handleBasicLabelConfigEvent,
  '/wls/raw/basic/processor': handleBasicProcessorEvent,
  '/wls/raw/basic/product-center': handleBasicProductCenterEvent,
  '/wls/raw/basic/subject': handleBasicSubjectEvent,
  '/wls/raw/basic/supplier': handleBasicSupplierEvent,
  '/wls/raw/basic/warehouse': handleBasicWarehouseEvent,
  '/wls/raw/basic/zone-location': handleBasicZoneLocationEvent,
  '/wls/raw/fabric-score': handleRawFabricScoreEvent,
  '/wls/raw/inbound-list': handleRawInboundListEvent,
  '/wls/raw/issue-list': handleRawIssueListEvent,
  '/wls/raw/outbound-list': handleRawOutboundListEvent,
  '/wls/raw/requisition-list': handleRawRequisitionListEvent,
  '/wls/raw/stock/accessory-inventory-count': handleRawAccessoryInventoryCountEvent,
  '/wls/raw/stock/accessory-transfer': handleRawAccessoryTransferEvent,
  '/wls/raw/stock/fabric-inventory-count': handleRawFabricInventoryCountEvent,
  '/wls/raw/stock/fabric-transfer': handleRawFabricTransferEvent,
  '/wls/raw/stock/flow': handleRawStockFlowEvent,
  '/wls/raw/stock/location': handleRawStockLocationEvent,
  '/wls/raw/stock/realtime': handleStockRealtimeEvent,
  '/wls/transit/allocation-manage': handleTransitAllocationManageEvent,
  '/wls/transit/basic/barcode-rule': handleBasicBarcodeRuleEvent,
  '/wls/transit/basic/label-config': handleBasicLabelConfigEvent,
  '/wls/transit/basic/processor': handleBasicProcessorEvent,
  '/wls/transit/basic/subject': handleBasicSubjectEvent,
  '/wls/transit/basic/warehouse': handleBasicWarehouseEvent,
  '/wls/transit/basic/zone-location': handleBasicZoneLocationEvent,
  '/wls/transit/inbound-manage': handleTransitInboundManageEvent,
  '/wls/transit/inventory': handleStockRealtimeEvent,
  '/wls/transit/kit-center': handleTransitKitCenterEvent,
  '/wls/transit/location': handleTransitLocationEvent,
  '/wls/transit/outbound-manage': handleTransitOutboundManageEvent,
  '/wls/transit/putaway-manage': handleTransitPutawayManageEvent,
  '/wls/transit/receive-manage': handleTransitReceiveManageEvent,
  '/wls/transit/warehouse-transfer': handleTransitWarehouseTransferEvent,
  '/wls/transit/work-area-manage': handleTransitWorkAreaManageEvent,
}

export function dispatchWlsPageEvent(pathname: string, target: HTMLElement, event?: Event): boolean {
  const handler = pageEventHandlers[pathname]
  return handler ? handler(target, event) : false
}
