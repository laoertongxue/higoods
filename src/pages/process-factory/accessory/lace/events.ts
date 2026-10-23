import { handleWlsAccessoryReceiptsEvent } from '../../../wls-accessory-receipts.ts'
import { handleLaceHandoverRecordsEvent } from './handover-records.ts'
import { handleLacePurchaseDemandsEvent } from './purchase-demands.ts'
import { handleLaceWorkOrderDetailEvent } from './work-order-detail.ts'
import { handleLaceWorkOrdersEvent } from './work-orders.ts'

export async function handleAccessoryFactoryManagementEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  return await handleLaceWorkOrderDetailEvent(target, event)
    || await handleLacePurchaseDemandsEvent(target, event)
    || await handleLaceWorkOrdersEvent(target, event)
    || handleLaceHandoverRecordsEvent(target, event)
    || await handleWlsAccessoryReceiptsEvent(target, event)
}
