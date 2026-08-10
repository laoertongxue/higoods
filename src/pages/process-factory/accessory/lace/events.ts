import { handlePmsPurchaseOrdersEvent } from '../../../pms-purchase-orders.ts'
import { handleWlsAccessoryReceiptsEvent } from '../../../wls-accessory-receipts.ts'
import { handleLaceHandoverRecordsEvent } from './handover-records.ts'
import { handleLacePurchaseDemandsEvent } from './purchase-demands.ts'
import { handleLaceWorkOrderDetailEvent } from './work-order-detail.ts'
import { handleLaceWorkOrdersEvent } from './work-orders.ts'

export function handleAccessoryFactoryManagementEvent(target: HTMLElement, event?: Event): boolean {
  return handleLaceWorkOrderDetailEvent(target, event)
    || handleLacePurchaseDemandsEvent(target, event)
    || handleLaceWorkOrdersEvent(target, event)
    || handleLaceHandoverRecordsEvent(target, event)
    || handleWlsAccessoryReceiptsEvent(target, event)
    || handlePmsPurchaseOrdersEvent(target, event)
}
