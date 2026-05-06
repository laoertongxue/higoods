import { closePdaShellDialogsOnEscape, handlePdaShellEvent } from '../pages/pda-shell'
import { handlePdaLoginEvent } from '../pages/pda-login'
import { handlePdaOnboardingEvent } from '../pages/pda-onboarding'
import { handlePdaNotifyEvent } from '../pages/pda-notify'
import { handlePdaNotifyDueSoonEvent } from '../pages/pda-notify-due-soon'
import { handlePdaNotifyDetailEvent } from '../pages/pda-notify-detail'
import { handlePdaQualityEvent } from '../pages/pda-quality'
import { handlePdaTaskReceiveEvent } from '../pages/pda-task-receive'
import { handlePdaTaskReceiveDetailEvent } from '../pages/pda-task-receive-detail'
import { handlePdaExecEvent } from '../pages/pda-exec'
import { handlePdaExecDetailEvent } from '../pages/pda-exec-detail'
import { handlePdaHandoverEvent } from '../pages/pda-handover'
import { handlePdaHandoverDetailEvent } from '../pages/pda-handover-detail'
import { handlePdaSettlementEvent } from '../pages/pda-settlement'
import { handlePdaWarehouseEvent } from '../pages/pda-warehouse'
import { handlePdaWarehouseWaitProcessEvent } from '../pages/pda-warehouse-wait-process'
import { handlePdaWarehouseWaitHandoverEvent } from '../pages/pda-warehouse-wait-handover'
import { handlePdaWarehouseInboundRecordsEvent } from '../pages/pda-warehouse-inbound-records'
import { handlePdaWarehouseOutboundRecordsEvent } from '../pages/pda-warehouse-outbound-records'
import { handlePdaWarehouseStocktakeEvent } from '../pages/pda-warehouse-stocktake'
import { handlePdaCuttingTaskDetailEvent } from '../pages/pda-cutting-task-detail'
import { handlePdaCuttingPickupEvent } from '../pages/pda-cutting-pickup'
import { handlePdaCuttingSpreadingEvent } from '../pages/pda-cutting-spreading'
import { handlePdaCuttingInboundEvent } from '../pages/pda-cutting-inbound'
import { handlePdaCuttingHandoverEvent } from '../pages/pda-cutting-handover'
import { handlePdaCuttingReplenishmentFeedbackEvent } from '../pages/pda-cutting-replenishment-feedback'

export async function dispatchPdaPageEvent(target: HTMLElement): Promise<boolean> {
  return (
    await handlePdaShellEvent(target) ||
    await handlePdaLoginEvent(target) ||
    await handlePdaOnboardingEvent(target) ||
    await handlePdaNotifyEvent(target) ||
    await handlePdaNotifyDueSoonEvent(target) ||
    await handlePdaNotifyDetailEvent(target) ||
    await handlePdaQualityEvent(target) ||
    await handlePdaTaskReceiveEvent(target) ||
    await handlePdaTaskReceiveDetailEvent(target) ||
    await handlePdaExecEvent(target) ||
    await handlePdaExecDetailEvent(target) ||
    await handlePdaWarehouseEvent(target) ||
    await handlePdaWarehouseWaitProcessEvent(target) ||
    await handlePdaWarehouseWaitHandoverEvent(target) ||
    await handlePdaWarehouseInboundRecordsEvent(target) ||
    await handlePdaWarehouseOutboundRecordsEvent(target) ||
    await handlePdaWarehouseStocktakeEvent(target) ||
    await handlePdaCuttingTaskDetailEvent(target) ||
    await handlePdaCuttingPickupEvent(target) ||
    await handlePdaCuttingSpreadingEvent(target) ||
    await handlePdaCuttingInboundEvent(target) ||
    await handlePdaCuttingHandoverEvent(target) ||
    await handlePdaCuttingReplenishmentFeedbackEvent(target) ||
    await handlePdaHandoverEvent(target) ||
    await handlePdaHandoverDetailEvent(target) ||
    await handlePdaSettlementEvent(target)
  )
}

export function closePdaDialogsOnEscape(): boolean {
  return closePdaShellDialogsOnEscape()
}
